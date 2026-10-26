import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: vi.fn(), users: vi.fn(), mail: vi.fn() }));
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class { send = mocks.db; }, PutItemCommand: class { constructor(public input: unknown) {} }, UpdateItemCommand: class { constructor(public input: unknown) {} }, DeleteItemCommand: class { constructor(public input: unknown) {} } }));
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({ CognitoIdentityProviderClient: class { send = mocks.users; }, ListUsersInGroupCommand: class { constructor(public input: unknown) {} } }));
vi.mock('@aws-sdk/client-sesv2', () => ({ SESv2Client: class { send = mocks.mail; }, SendEmailCommand: class { constructor(public input: unknown) {} } }));
import { handler } from './handler';
const image = Object.fromEntries(Object.entries({ id: 'report-1234', title: 'Upload failed', reporterEmail: 'client@example.com', reporterName: 'Manasa', status: 'NEW' }).map(([key, S]) => [key, { S }]));
const record = { eventID: 'event1', eventName: 'INSERT', dynamodb: { SequenceNumber: '1', NewImage: image } };
beforeEach(() => {
  vi.stubEnv('HARVEST_STAGING_USER_POOL_ID', ''); vi.stubEnv('FEEDBACK_EMAIL_ENABLED', 'true'); vi.stubEnv('APP_BASE_URL', 'https://feedback.example.com'); vi.stubEnv('EMAIL_DELIVERY_TABLE', 'deliveries'); vi.stubEnv('USER_POOL_ID', 'pool');
  vi.stubEnv('CLIENT_NOTIFICATION_FROM_EMAIL', 'harvest@withmeridian.ai'); vi.stubEnv('ADMIN_NOTIFICATION_FROM_EMAIL', 'harvest@withmeridian.ai');
  mocks.db.mockReset().mockResolvedValue({}); mocks.mail.mockReset().mockResolvedValue({});
  mocks.users.mockReset().mockResolvedValue({ Users: [{ Enabled: true, Attributes: [{ Name: 'email', Value: 'admin@example.com' }] }] });
});
it('sends both audiences HTML/text emails with their respective replyable sender', async () => {
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [] });
  expect(mocks.mail).toHaveBeenCalledTimes(2);
  const client = mocks.mail.mock.calls[0][0].input, admin = mocks.mail.mock.calls[1][0].input;
  expect(client).toMatchObject({ FromEmailAddress: 'HARVEST <harvest@withmeridian.ai>', ReplyToAddresses: ['harvest@withmeridian.ai'], Destination: { ToAddresses: ['client@example.com'] } });
  expect(admin).toMatchObject({ FromEmailAddress: 'HARVEST <harvest@withmeridian.ai>', ReplyToAddresses: ['harvest@withmeridian.ai'], Destination: { ToAddresses: ['admin@example.com'] } });
  expect(client.Content.Simple.Body.Html.Data).toContain('background:#fffdf9');
  expect(admin.Content.Simple.Body.Text.Data).toContain('/admin/reviews?report=report-1234');
});
it('skips already sent receipts on stream redelivery', async () => {
  mocks.db.mockRejectedValue(Object.assign(new Error(), { name: 'ConditionalCheckFailedException', Item: { state: { S: 'SENT' } } }));
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [] });
  expect(mocks.mail).not.toHaveBeenCalled();
});
it('returns a failed record for retry instead of failing a saved submission', async () => {
  mocks.mail.mockRejectedValue(new Error('SES unavailable'));
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [{ itemIdentifier: '1' }] });
  expect(mocks.db.mock.calls[1][0].input).toMatchObject({ Key: { id: { S: expect.any(String) } } });
});
it('does not send while delivery is disabled', async () => {
  vi.stubEnv('FEEDBACK_EMAIL_ENABLED', 'false');
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [] });
  expect(mocks.mail).not.toHaveBeenCalled();
});
it('rejects no-reply senders', async () => {
  vi.stubEnv('CLIENT_NOTIFICATION_FROM_EMAIL', 'no-reply@example.com');
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [{ itemIdentifier: '1' }] });
  expect(mocks.mail).not.toHaveBeenCalled();
});

it.each([
  ['request', { updateRequestedAt: { S: '2026-10-12T12:00:00Z' } }, 'admin@example.com', 'An update was requested'],
  ['update', { adminActivityAt: { S: '2026-10-12T12:00:00Z' } }, 'client@example.com', 'An update on your report'],
  ['assigned', { status: { S: 'ASSIGNED' }, adminActivityAt: { S: 'now' } }, 'client@example.com', 'progress changed'],
  ['progress', { status: { S: 'IN_PROGRESS' }, adminActivityAt: { S: 'now' } }, 'client@example.com', 'progress changed'],
  ['closed', { status: { S: 'CLOSED' }, adminActivityAt: { S: 'now' } }, 'client@example.com', 'Your report was closed'],
])('delivers %s to the trusted recipient exactly once per committed event', async (_name, changes, recipient, subject) => {
  const modified = { eventID: 'change1', eventName: 'MODIFY', dynamodb: { SequenceNumber: '2', OldImage: image, NewImage: { ...image, ...changes } } };
  expect(await handler({ Records: [modified] })).toEqual({ batchItemFailures: [] });
  expect(mocks.mail).toHaveBeenCalledTimes(1);
  expect(mocks.mail.mock.calls[0][0].input.Destination.ToAddresses).toEqual([recipient]);
  expect(mocks.mail.mock.calls[0][0].input.Content.Simple.Subject.Data).toContain(subject);
});
it('sends receipts without report links while the app remains local', async () => {
  vi.stubEnv('APP_BASE_URL', '');
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [] });
  expect(mocks.mail).toHaveBeenCalledTimes(2);
  expect(mocks.mail.mock.calls[0][0].input.Content.Simple.Body.Html.Data).not.toContain('<a href=');
});
it('rejects invalid configured links before sending', async () => {
  vi.stubEnv('APP_BASE_URL', 'http://localhost:5178');
  await expect(handler({ Records: [record] })).rejects.toThrow('configuration');
  expect(mocks.mail).not.toHaveBeenCalled();
});
it('combines and deduplicates enabled administrators across feedback and HARVEST pools', async () => {
  vi.stubEnv('HARVEST_STAGING_USER_POOL_ID', 'harvest-pool');
  mocks.users.mockResolvedValue({ Users: [
    { Enabled: true, Attributes: [{ Name: 'email', Value: 'admin@example.com' }] },
    { Enabled: false, Attributes: [{ Name: 'email', Value: 'disabled@example.com' }] },
  ] });
  await handler({ Records: [record] });
  expect(mocks.users.mock.calls.map(call => call[0].input)).toEqual([
    { UserPoolId: 'pool', GroupName: 'admins', NextToken: undefined },
    { UserPoolId: 'harvest-pool', GroupName: 'feedback-admins', NextToken: undefined },
  ]);
  expect(mocks.mail).toHaveBeenCalledTimes(2);
});

it('embeds the screenshot-based orange mark inline instead of relying on remote-image loading', async () => {
  await handler({ Records: [record] });
  const attachment = mocks.mail.mock.calls[0][0].input.Content.Simple.Attachments[0];
  expect(attachment).toMatchObject({ ContentId: 'harvest-feedback-mark', ContentDisposition: 'INLINE', ContentType: 'image/png' });
  expect(attachment.RawContent.byteLength).toBeGreaterThan(100);
  expect(mocks.mail.mock.calls[0][0].input.Content.Simple.Body.Html.Data).toContain('cid:harvest-feedback-mark');
});
