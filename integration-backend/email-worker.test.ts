import { beforeEach, expect, it, vi } from 'vitest';
import { handler } from './email-worker';
import { selectedAdministrators } from './administrators';
const sdk = vi.hoisted(() => ({ db: vi.fn(), ses: vi.fn() }));
vi.mock('@aws-sdk/client-dynamodb', async original => ({ ...await original<object>(), DynamoDBClient: class { send = sdk.db } }));
vi.mock('@aws-sdk/client-sesv2', async original => ({ ...await original<object>(), SESv2Client: class { send = sdk.ses } }));
vi.mock('./administrators', () => ({ selectedAdministrators: vi.fn() }));
const image = { id: { S: 'report-uuid' }, title: { S: 'Broken button' }, reporterEmail: { S: 'client@withmeridian.ai' }, reporterName: { S: 'Client' }, company: { S: 'Company One' }, persona: { S: 'Company' }, priority: { S: 'BUG' }, status: { S: 'NEW' } };
const record = { eventID: 'event-1', eventName: 'INSERT', dynamodb: { SequenceNumber: '1', NewImage: image } };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('FEEDBACK_EMAIL_ENABLED', 'true'); vi.stubEnv('EMAIL_DELIVERY_TABLE', 'receipts');
  vi.stubEnv('APP_BASE_URL', 'https://harvest-refresh-prestaging-meridian.netlify.app/feedback');
  vi.stubEnv('CLIENT_NOTIFICATION_FROM_EMAIL', 'sahil+feedback@withmeridian.ai'); vi.stubEnv('ADMIN_NOTIFICATION_FROM_EMAIL', 'manasa+feedback@withmeridian.ai');
  sdk.db.mockResolvedValue({}); sdk.ses.mockResolvedValue({});
  vi.mocked(selectedAdministrators).mockResolvedValue([{ sub: 'sub', email: 'sahil+admin@withmeridian.ai', name: 'Sahil' }]);
});
it('preserves the latest templates and routes both audiences through HARVEST', async () => {
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [] });
  expect(sdk.ses).toHaveBeenCalledTimes(2);
  const client = sdk.ses.mock.calls[0][0].input, admin = sdk.ses.mock.calls[1][0].input;
  expect(client.Destination.ToAddresses).toEqual(['client@withmeridian.ai']);
  expect(admin.Destination.ToAddresses).toEqual(['sahil+admin@withmeridian.ai']);
  expect(admin.Content.Simple.Body.Text.Data).toContain('/feedback/admin/reviews?report=report-uuid');
  expect(client.Content.Simple.Body.Text.Data).toContain('/feedback/mine?report=report-uuid');
  expect(admin.ReplyToAddresses).toEqual(['manasa+feedback@withmeridian.ai']);
});
it('returns a retry identity when current admin membership cannot be verified', async () => {
  vi.mocked(selectedAdministrators).mockRejectedValue(new Error('Directory unavailable'));
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [{ itemIdentifier: '1' }] });
  expect(sdk.ses).toHaveBeenCalledTimes(1); // The committed client receipt has a delivery lease.
});
it('skips previously delivered notices and does not invent owner-change emails', async () => {
  sdk.db.mockRejectedValue({ name: 'ConditionalCheckFailedException', Item: { state: { S: 'SENT' } } });
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [] });
  expect(sdk.ses).not.toHaveBeenCalled();
  sdk.db.mockResolvedValue({});
  expect(await handler({ Records: [{ ...record, eventName: 'MODIFY', dynamodb: { ...record.dynamodb, OldImage: image, NewImage: { ...image, assignee: { S: 'other' } } } }] })).toEqual({ batchItemFailures: [] });
  expect(sdk.ses).not.toHaveBeenCalled();
});
it('retries a failed SES send and releases only its own lease', async () => {
  sdk.ses.mockRejectedValue(new Error('SES unavailable'));
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [{ itemIdentifier: '1' }] });
  const release = sdk.db.mock.calls.find(([command]) => command.constructor.name === 'DeleteItemCommand')![0];
  expect(release.input.ConditionExpression).toBe('leaseId = :lease');
});
it('fails closed while delivery is disabled', async () => {
  vi.stubEnv('FEEDBACK_EMAIL_ENABLED', 'false');
  await expect(handler({ Records: [record] })).rejects.toThrow('disabled');
  expect(sdk.ses).not.toHaveBeenCalled();
});
