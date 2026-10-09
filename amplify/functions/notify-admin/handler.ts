import { CognitoIdentityProviderClient, ListUsersInGroupCommand, type UserType } from '@aws-sdk/client-cognito-identity-provider';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { adminEmails, reportNotice, type ReportNotice } from './message';

const cognito = new CognitoIdentityProviderClient({});
const ses = new SESv2Client({});

export async function handler(report: ReportNotice): Promise<{ sent: boolean }> {
  if (report.sentryIssueId) return { sent: false };
  const from = process.env.ADMIN_NOTIFICATION_FROM_EMAIL?.trim();
  const poolId = process.env.USER_POOL_ID;
  if (!from || !poolId) {
    console.warn('Admin report email is not configured.');
    return { sent: false };
  }
  try {
    const users: UserType[] = [];
    let nextToken: string | undefined;
    do {
      const page = await cognito.send(new ListUsersInGroupCommand({ UserPoolId: poolId, GroupName: 'admins', NextToken: nextToken }));
      users.push(...(page.Users ?? []));
      nextToken = page.NextToken;
    } while (nextToken);
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
