import { beforeEach, expect, it, vi } from 'vitest';
import { marshall } from '@aws-sdk/util-dynamodb';
import { handler } from './handler';
import { authorize } from './authorization';
import { readConfiguredSentryIssues } from './sentry-issues';
import { readConfiguredGa4Traffic } from './ga4-traffic';
const sdk = vi.hoisted(() => ({ db: vi.fn(), s3: vi.fn(), sign: vi.fn() }));
vi.mock('@aws-sdk/client-dynamodb', async original => ({ ...await original<object>(), DynamoDBClient: class { send = sdk.db } }));
vi.mock('@aws-sdk/client-s3', async original => ({ ...await original<object>(), S3Client: class { send = sdk.s3 } }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: sdk.sign }));
vi.mock('./authorization', async original => ({ ...await original<object>(), authorize: vi.fn() }));
vi.mock('./sentry-issues', () => ({ readConfiguredSentryIssues: vi.fn() }));
vi.mock('./ga4-traffic', () => ({ readConfiguredGa4Traffic: vi.fn() }));
const actor = { sub: 'sub', admin: false, viewer: { person: { id: 'person', name: 'Trusted Name', email: 'trusted@example.com' }, memberships: [{ orgId: 'org', orgKind: 'company' as const, orgName: 'Trusted Company', role: 'user' as const }] } };
const call = (fieldName: string, args: Record<string, unknown>) => handler({ info: { fieldName }, arguments: args });
beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ['REPORTS_TABLE', 'READS_TABLE', 'ADMINS_TABLE', 'ATTACHMENTS_TABLE', 'MEDIA_BUCKET']) vi.stubEnv(key, key);
  vi.mocked(authorize).mockResolvedValue(actor);
  sdk.db.mockResolvedValue({}); sdk.s3.mockResolvedValue({}); sdk.sign.mockResolvedValue('https://media.example.com/capability');
});
it('derives identity and severity and commits a report without editable owner fields', async () => {
  const report = await call('submitFeedback', { organizationId: 'org', description: ' Broken button ', productArea: 'Data room', priority: 'BUG', severity: 'LOW', reporterEmail: 'forged@example.com', owner: 'other' });
  expect(report).toMatchObject({ owner: 'sub', reporterEmail: 'trusted@example.com', company: 'Trusted Company', severity: 'MEDIUM', status: 'NEW' });
  expect(sdk.db.mock.calls[0][0].constructor.name).toBe('TransactWriteItemsCommand');
});
it('denies another reporter and admin-field writes before an update', async () => {
  sdk.db.mockResolvedValue({ Item: marshall({ id: 'r', owner: 'other', organizationId: 'org', status: 'NEW', revision: 0 }) });
  await expect(call('getFeedback', { id: 'r' })).rejects.toThrow('Report unavailable');
  sdk.db.mockResolvedValue({ Item: marshall({ id: 'r', owner: 'sub', organizationId: 'org', status: 'NEW', revision: 0 }) });
  await expect(call('updateFeedback', { input: { id: 'r', status: 'CLOSED' } })).rejects.toThrow('Unauthorized report change');
  expect(sdk.db.mock.calls.every(([command]) => command.constructor.name === 'GetItemCommand')).toBe(true);
});
it('filters leaked or revoked-organization index rows on the server', async () => {
  sdk.db.mockResolvedValue({ Items: [marshall({ owner: 'sub', organizationId: 'org' }), marshall({ owner: 'other', organizationId: 'org' }), marshall({ owner: 'sub', organizationId: 'removed' })] });
  expect(await call('listFeedbacks', {})).toMatchObject({ items: [{ owner: 'sub', organizationId: 'org' }] });
});
it('claims an attachment atomically and pins its verified S3 version', async () => {
  sdk.db.mockResolvedValueOnce({ Item: marshall({ id: 'key', owner: 'sub', organizationId: 'org', size: 2, contentType: 'image/png', name: 'image.png', expiresAt: Math.floor(Date.now() / 1000) + 1000 }) });
  sdk.s3.mockResolvedValue({ ContentLength: 2, ContentType: 'image/png', VersionId: 'immutable-version' });
  await call('submitFeedback', { organizationId: 'org', description: 'Broken button', productArea: 'Data room', priority: 'BUG', attachmentKey: 'key' });
  const transaction = sdk.db.mock.calls[1][0].input.TransactItems;
  expect(transaction).toHaveLength(2);
  expect(transaction[1].Update.ConditionExpression).toContain('attribute_not_exists(reportId)');
  expect(transaction[1].Update.ExpressionAttributeValues[':version']).toEqual({ S: 'immutable-version' });
});
it('claims several attachments in one transaction and mirrors the first into the legacy fields', async () => {
  const upload = (id: string, name: string) => ({ Item: marshall({ id, owner: 'sub', organizationId: 'org', size: 2, contentType: 'image/png', name, expiresAt: Math.floor(Date.now() / 1000) + 1000 }) });
  sdk.db.mockResolvedValueOnce(upload('a', 'first.png')).mockResolvedValueOnce(upload('b', 'second.png'));
  sdk.s3.mockResolvedValue({ ContentLength: 2, ContentType: 'image/png', VersionId: 'v' });
  const report = await call('submitFeedback', { organizationId: 'org', description: 'Broken button', productArea: 'Data room', priority: 'BUG', attachmentKeys: ['a', 'b'] });
  expect(report).toMatchObject({ attachmentKey: 'a', attachmentName: 'first.png', attachments: [{ attachmentKey: 'a' }, { attachmentKey: 'b', attachmentName: 'second.png' }] });
  const transaction = sdk.db.mock.calls[2][0].input.TransactItems;
  expect(transaction).toHaveLength(3);
  expect(transaction.slice(1).every((write: any) => write.Update.ConditionExpression.includes('attribute_not_exists(reportId)'))).toBe(true);
});
it('rejects duplicate keys and more than five attachments before reading uploads', async () => {
  const base = { organizationId: 'org', description: 'Broken button', productArea: 'Data room', priority: 'BUG' };
  await expect(call('submitFeedback', { ...base, attachmentKey: 'a', attachmentKeys: ['a'] })).rejects.toThrow('Attachment unavailable');
  await expect(call('submitFeedback', { ...base, attachmentKeys: ['1', '2', '3', '4', '5', '6'] })).rejects.toThrow('Attachment unavailable');
  await expect(call('submitFeedback', { ...base, attachmentKeys: 'a' })).rejects.toThrow('Attachment unavailable');
  expect(sdk.db).not.toHaveBeenCalled();
});
it('denies claimed-object deletion and oversized uploads', async () => {
  sdk.db.mockResolvedValueOnce({ Item: marshall({ id: 'key', reportId: 'r', owner: 'sub' }) })
    .mockResolvedValueOnce({ Item: marshall({ id: 'r', owner: 'sub', organizationId: 'org' }) });
  await expect(call('removeAttachment', { key: 'key' })).rejects.toThrow('already linked');
  await expect(call('prepareAttachment', { organizationId: 'org', name: 'x.png', contentType: 'image/png', size: 50 * 1024 * 1024 + 1 })).rejects.toThrow('Invalid attachment');
  expect(sdk.s3).not.toHaveBeenCalled(); expect(sdk.sign).not.toHaveBeenCalled();
});
it('propagates membership revocation before storage or database access', async () => {
  vi.mocked(authorize).mockRejectedValue(new Error('Unauthorized'));
  await expect(call('attachmentAccess', { key: 'key', operation: 'GET' })).rejects.toThrow('Unauthorized');
  expect(sdk.db).not.toHaveBeenCalled(); expect(sdk.s3).not.toHaveBeenCalled();
});
it('only lets a verified current admin read Sentry issues', async () => {
  await expect(call('sentryIssues', {})).rejects.toThrow('Admin access required.');
  expect(readConfiguredSentryIssues).not.toHaveBeenCalled();
  vi.mocked(authorize).mockResolvedValue({ ...actor, admin: true });
  vi.mocked(readConfiguredSentryIssues).mockResolvedValue({ configured: true, issues: [] });
  await expect(call('sentryIssues', {})).resolves.toEqual({ configured: true, issues: [] });
  expect(readConfiguredSentryIssues).toHaveBeenCalledOnce();
});
it('only lets a verified current admin read HARVEST GA4 traffic', async () => {
  await expect(call('trafficInsights', {})).rejects.toThrow('Admin access required.');
  expect(readConfiguredGa4Traffic).not.toHaveBeenCalled();
  vi.mocked(authorize).mockResolvedValue({ ...actor, admin: true });
  vi.mocked(readConfiguredGa4Traffic).mockResolvedValue({ configured: true, users: 0, sessions: 0, pageViews: 0, days: [], pages: [] });
  await expect(call('trafficInsights', {})).resolves.toMatchObject({ configured: true, users: 0 });
  expect(readConfiguredGa4Traffic).toHaveBeenCalledOnce();
});
