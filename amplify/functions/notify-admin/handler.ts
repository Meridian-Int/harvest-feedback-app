import { CognitoIdentityProviderClient, ListUsersInGroupCommand, type UserType } from '@aws-sdk/client-cognito-identity-provider';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { adminEmails, reportNotice, type ReportNotice } from './message';

const cognito = new CognitoIdentityProviderClient({});
const ses = new SESv2Client({});

export async function handler(report: ReportNotice): Promise<{ sent: boolean }> {
  // Keep the existing admin alert until stream delivery is explicitly enabled.
  if (process.env.FEEDBACK_EMAIL_ENABLED === 'true') return { sent: false };
  if (report.sentryIssueId) return { sent: false };
  const from = process.env.ADMIN_NOTIFICATION_FROM_EMAIL?.trim();
  const poolId = process.env.USER_POOL_ID;
  if (!from || !poolId) {
    console.warn('Admin report email is not configured.');
    return { sent: false };
  }
  try {
    const users: UserType[] = [];
    for (const source of [
      { pool: poolId, group: 'admins' },
      ...(process.env.HARVEST_STAGING_USER_POOL_ID ? [{ pool: process.env.HARVEST_STAGING_USER_POOL_ID, group: 'feedback-admins' }] : []),
    ]) {
      let nextToken: string | undefined;
      do {
        const page = await cognito.send(new ListUsersInGroupCommand({ UserPoolId: source.pool, GroupName: source.group, NextToken: nextToken }));
        users.push(...(page.Users ?? []));
        nextToken = page.NextToken;
      } while (nextToken);
    }
    const recipients = adminEmails(users);
    if (!recipients.length) {
      console.warn('No admin email recipients are configured.');
      return { sent: false };
    }
    const { subject, body } = reportNotice(report, process.env.APP_BASE_URL ?? '');
    await ses.send(new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { BccAddresses: recipients },
      Content: { Simple: { Subject: { Data: subject }, Body: { Text: { Data: body } } } },
    }));
    return { sent: true };
  } catch (cause) {
    console.error('Admin report email failed', cause);
    return { sent: false };
  }
}
