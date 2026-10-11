import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: vi.fn(), users: vi.fn(), mail: vi.fn() }));
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class { send = mocks.db; }, PutItemCommand: class { constructor(public input: unknown) {} }, UpdateItemCommand: class { constructor(public input: unknown) {} }, DeleteItemCommand: class { constructor(public input: unknown) {} } }));
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({ CognitoIdentityProviderClient: class { send = mocks.users; }, ListUsersInGroupCommand: class { constructor(public input: unknown) {} } }));
vi.mock('@aws-sdk/client-sesv2', () => ({ SESv2Client: class { send = mocks.mail; }, SendEmailCommand: class { constructor(public input: unknown) {} } }));
import { handler } from './handler';
const image = Object.fromEntries(Object.entries({ id: 'report-1234', title: 'Upload failed', reporterEmail: 'client@example.com', reporterName: 'Manasa', status: 'NEW' }).map(([key, S]) => [key, { S }]));
const record = { eventID: 'event1', eventName: 'INSERT', dynamodb: { SequenceNumber: '1', NewImage: image } };
beforeEach(() => {
  vi.stubEnv('FEEDBACK_EMAIL_ENABLED', 'true'); vi.stubEnv('APP_BASE_URL', 'https://feedback.example.com'); vi.stubEnv('EMAIL_DELIVERY_TABLE', 'deliveries'); vi.stubEnv('USER_POOL_ID', 'pool');
  vi.stubEnv('CLIENT_NOTIFICATION_FROM_EMAIL', 'sahil+feedback@withmeridian.ai'); vi.stubEnv('ADMIN_NOTIFICATION_FROM_EMAIL', 'manasa+feedback@withmeridian.ai');
  mocks.db.mockReset().mockResolvedValue({}); mocks.mail.mockReset().mockResolvedValue({});
  mocks.users.mockReset().mockResolvedValue({ Users: [{ Enabled: true, Attributes: [{ Name: 'email', Value: 'admin@example.com' }] }] });
});
it('sends both audiences HTML/text emails with their respective replyable sender', async () => {
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [] });
  expect(mocks.mail).toHaveBeenCalledTimes(2);
  const client = mocks.mail.mock.calls[0][0].input, admin = mocks.mail.mock.calls[1][0].input;
  expect(client).toMatchObject({ FromEmailAddress: 'sahil+feedback@withmeridian.ai', ReplyToAddresses: ['sahil+feedback@withmeridian.ai'], Destination: { ToAddresses: ['client@example.com'] } });
  expect(admin).toMatchObject({ FromEmailAddress: 'manasa+feedback@withmeridian.ai', ReplyToAddresses: ['manasa+feedback@withmeridian.ai'], Destination: { ToAddresses: ['admin@example.com'] } });
  expect(client.Content.Simple.Body.Html.Data).toContain('background:#eee9df');
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
