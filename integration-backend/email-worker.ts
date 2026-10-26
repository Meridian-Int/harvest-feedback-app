import { createHash, randomUUID } from 'node:crypto';
import { DynamoDBClient, PutItemCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { integrationNoticesFor as noticesFor } from './email-events';
import { feedbackEmail } from '../amplify/functions/email-content';
import { feedbackMarkContentId, feedbackMarkPngBase64 } from '../amplify/functions/feedback-email/brand';
import { selectedAdministrators } from './administrators';
const db = new DynamoDBClient({});
const ses = new SESv2Client({});
type StreamRecord = Parameters<typeof noticesFor>[0] & { eventID?: string; dynamodb?: Parameters<typeof noticesFor>[0]['dynamodb'] & { SequenceNumber?: string } };

// HARVEST's own support address; withmeridian.ai is the domain verified in SES.
export const HARVEST_SENDER = 'harvest@withmeridian.ai';

export async function handler(event: { Records: StreamRecord[] }) {
  if (process.env.FEEDBACK_EMAIL_ENABLED !== 'true') throw new Error('Feedback email delivery is disabled.');
  const base = new URL(process.env.APP_BASE_URL ?? '');
  const table = process.env.EMAIL_DELIVERY_TABLE;
  const localDemo = ['dev', 'test'].includes(process.env.FEEDBACK_TARGET ?? '') && base.origin === 'http://localhost:5173';
    const allowedOrigins = process.env.FEEDBACK_TARGET === 'production' ? ['https://harvestbymeridian.ai'] : ['https://harvest-refresh-prestaging-meridian.netlify.app', 'https://staging.harvestbymeridian.ai', 'https://harvest-refresh-staging-meridian.netlify.app'];
    if (!table || (!localDemo && !allowedOrigins.includes(base.origin)) || base.pathname.replace(/\/$/, '') !== '/feedback' || base.username || base.password || base.search || base.hash) throw new Error('Feedback email configuration is incomplete.');
  const failures: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records) {
    try {
      for (const notice of noticesFor(record)) {
        const recipients = notice.audience === 'client' ? [notice.report.reporterEmail] : (await selectedAdministrators()).map(admin => admin.email);
        if (!recipients.length) throw new Error('No active selected Feedback administrators.');
        const from = notice.audience === 'client' ? process.env.CLIENT_NOTIFICATION_FROM_EMAIL : process.env.ADMIN_NOTIFICATION_FROM_EMAIL;
        if (!from || from !== HARVEST_SENDER) throw new Error('Feedback sender is not configured.');
        for (const recipient of recipients) {
          if (!record.eventID || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('Invalid event recipient.');
          const key = createHash('sha256').update(`${record.eventID}:${notice.kind}:${recipient.toLowerCase()}`).digest('hex');
          const now = Math.floor(Date.now() / 1000), lease = randomUUID();
          try {
            await db.send(new PutItemCommand({ TableName: table, Item: { id: { S: key }, state: { S: 'SENDING' }, reportId: { S: notice.report.id }, kind: { S: notice.kind }, audience: { S: notice.audience }, leaseId: { S: lease }, leaseUntil: { N: String(now + 120) }, expiresAt: { N: String(now + 7 * 86400) } }, ConditionExpression: 'attribute_not_exists(id) OR (#state = :sending AND leaseUntil < :now)', ExpressionAttributeNames: { '#state': 'state' }, ExpressionAttributeValues: { ':sending': { S: 'SENDING' }, ':now': { N: String(now) } }, ReturnValuesOnConditionCheckFailure: 'ALL_OLD' }));
          } catch (cause) {
            const error = cause as { name?: string; Item?: { state?: { S?: string } } };
            if (error.name === 'ConditionalCheckFailedException' && error.Item?.state?.S === 'SENT') continue;
            throw cause;
          }
          const url = new URL(notice.audience === 'admin' ? '/feedback/admin/reviews' : '/feedback/mine', base.origin);
          url.searchParams.set('report', notice.report.id);
          const content = feedbackEmail({ kind: notice.kind, reportId: notice.report.id, reportTitle: notice.report.title, reporterName: notice.report.reporterName, priority: notice.report.priority, persona: notice.report.persona, company: notice.report.company, status: notice.report.status, previousStatus: notice.previousStatus, reportUrl: url.href, localDemo });
          try {
            await ses.send(new SendEmailCommand({ FromEmailAddress: `HARVEST <${from}>`, ReplyToAddresses: [from], Destination: { ToAddresses: [recipient] }, Content: { Simple: { Attachments: [{ RawContent: Buffer.from(feedbackMarkPngBase64, 'base64'), FileName: 'harvest-mark.png', ContentDisposition: 'INLINE', ContentId: feedbackMarkContentId, ContentType: 'image/png', ContentTransferEncoding: 'BASE64' }], Subject: { Data: content.subject, Charset: 'UTF-8' }, Body: { Html: { Data: content.html, Charset: 'UTF-8' }, Text: { Data: content.text, Charset: 'UTF-8' } } } } }));
          } catch (cause) {
            await db.send(new DeleteItemCommand({ TableName: table, Key: { id: { S: key } }, ConditionExpression: 'leaseId = :lease', ExpressionAttributeValues: { ':lease': { S: lease } } }));
            throw cause;
          }
          await db.send(new UpdateItemCommand({ TableName: table, Key: { id: { S: key } }, UpdateExpression: 'SET #state = :sent', ConditionExpression: 'leaseId = :lease', ExpressionAttributeNames: { '#state': 'state' }, ExpressionAttributeValues: { ':sent': { S: 'SENT' }, ':lease': { S: lease } } }));
        }
      }
    } catch {
      if (!record.dynamodb?.SequenceNumber) throw new Error('Email event has no retry identity.');
      failures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }
  return { batchItemFailures: failures };
}
