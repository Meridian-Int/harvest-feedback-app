import { createHash } from 'node:crypto';
import { DynamoDBClient, PutItemCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProviderClient, ListUsersInGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { feedbackEmail } from '../email-content';
import { adminEmails } from '../notify-admin/message';
import { noticesFor } from './events';

const db = new DynamoDBClient({});
const cognito = new CognitoIdentityProviderClient({});
const ses = new SESv2Client({});
type Record = Parameters<typeof noticesFor>[0] & { eventID?: string; dynamodb?: Parameters<typeof noticesFor>[0]['dynamodb'] & { SequenceNumber?: string } };

async function administrators(): Promise<string[]> {
  const users = [];
  let token: string | undefined;
  do {
    const page = await cognito.send(new ListUsersInGroupCommand({ UserPoolId: process.env.USER_POOL_ID, GroupName: 'admins', NextToken: token }));
    users.push(...(page.Users ?? [])); token = page.NextToken;
  } while (token);
  return adminEmails(users);
}

export async function handler(event: { Records: Record[] }): Promise<{ batchItemFailures: { itemIdentifier: string }[] }> {
  const failures: { itemIdentifier: string }[] = [];
  // No silent dropping of notifications when enabled but misconfigured.
  if (process.env.FEEDBACK_EMAIL_ENABLED !== 'true') return { batchItemFailures: [] };
  const base = process.env.APP_BASE_URL;
  const table = process.env.EMAIL_DELIVERY_TABLE;
  if (!base || new URL(base).protocol !== 'https:' || !table || !process.env.USER_POOL_ID) throw new Error('Feedback email delivery configuration is incomplete.');
  let admins: string[] | undefined;
  for (const record of event.Records) {
    try {
      for (const notice of noticesFor(record)) {
        const from = notice.audience === 'client' ? process.env.CLIENT_NOTIFICATION_FROM_EMAIL : process.env.ADMIN_NOTIFICATION_FROM_EMAIL;
        if (!from || /no[-_]?reply/i.test(from)) throw new Error('A replyable email sender is required.');
        const recipients = notice.audience === 'client' ? [notice.report.reporterEmail] : (admins ??= await administrators());
        if (!recipients.length) throw new Error('No enabled administrator recipients are configured.');
        for (const recipient of recipients) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('Invalid report recipient.');
          if (!record.eventID) throw new Error('Missing stream event identity.');
          const key = createHash('sha256').update(`${record.eventID}:${notice.kind}:${recipient.toLowerCase()}`).digest('hex');
          const now = Math.floor(Date.now() / 1000);
          try {
            await db.send(new PutItemCommand({ TableName: table, Item: { id: { S: key }, state: { S: 'SENDING' }, leaseUntil: { N: String(now + 120) }, expiresAt: { N: String(now + 7 * 86400) } },
              ConditionExpression: 'attribute_not_exists(id) OR (#state = :sending AND leaseUntil < :now)',
              ExpressionAttributeNames: { '#state': 'state' }, ExpressionAttributeValues: { ':sending': { S: 'SENDING' }, ':now': { N: String(now) } }, ReturnValuesOnConditionCheckFailure: 'ALL_OLD' }));
          } catch (cause) {
            const failure = cause as { name?: string; Item?: { state?: { S?: string } } };
            if (failure.name === 'ConditionalCheckFailedException' && failure.Item?.state?.S === 'SENT') continue;
            throw cause;
          }
          const path = notice.audience === 'admin' ? '/admin/reviews' : '/feedback/mine';
          const url = new URL(path, base); url.searchParams.set('report', notice.report.id);
          const email = feedbackEmail({ kind: notice.kind, reportId: notice.report.id, reportTitle: notice.report.title, reporterName: notice.report.reporterName, status: notice.report.status, reportUrl: url.href });
          try {
            await ses.send(new SendEmailCommand({ FromEmailAddress: from, ReplyToAddresses: [from], Destination: { ToAddresses: [recipient] },
              Content: { Simple: { Subject: { Data: email.subject, Charset: 'UTF-8' }, Body: { Html: { Data: email.html, Charset: 'UTF-8' }, Text: { Data: email.text, Charset: 'UTF-8' } } } } }));
          } catch (cause) {
            await db.send(new DeleteItemCommand({ TableName: table, Key: { id: { S: key } } }));
            throw cause;
          }
          await db.send(new UpdateItemCommand({ TableName: table, Key: { id: { S: key } }, UpdateExpression: 'SET #state = :sent', ExpressionAttributeNames: { '#state': 'state' }, ExpressionAttributeValues: { ':sent': { S: 'SENT' } } }));
        }
      }
    } catch (cause) {
      // Never log report contents or inbox addresses.
      console.error('Feedback email delivery failed', { eventId: record.eventID, error: (cause as Error).name });
      if (!record.dynamodb?.SequenceNumber) throw cause;
      failures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }
  return { batchItemFailures: failures };
}
