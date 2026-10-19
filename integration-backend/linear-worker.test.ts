import { beforeEach, expect, it, vi } from 'vitest';
import { marshall } from '@aws-sdk/util-dynamodb';
import { handler, linkedAssigneeChange, pendingLinearReport, uploadReportFiles } from './linear-worker';
import { createOrFindLinearIssue, updateLinearAssignee, uploadLinearFile } from './linear';

const sdk = vi.hoisted(() => ({ db: vi.fn(), s3: vi.fn(), secret: vi.fn() }));
vi.mock('@aws-sdk/client-dynamodb', async original => ({ ...await original<object>(), DynamoDBClient: class { send = sdk.db } }));
vi.mock('@aws-sdk/client-s3', async original => ({ ...await original<object>(), S3Client: class { send = sdk.s3 } }));
vi.mock('@aws-sdk/client-secrets-manager', async original => ({ ...await original<object>(), SecretsManagerClient: class { send = sdk.secret } }));
vi.mock('./linear', async original => ({ ...await original<object>(), createOrFindLinearIssue: vi.fn(), updateLinearAssignee: vi.fn(), uploadLinearFile: vi.fn() }));

const row = { id: 'report-e247', title: 'Upload stalls', description: 'Upload stalls', productArea: 'Data room', priority: 'BUG', status: 'ASSIGNED', linearTeamId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', linearSyncStatus: 'PENDING' };
const record = { eventName: 'MODIFY', dynamodb: { NewImage: marshall(row), SequenceNumber: 'sequence-1' } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('REPORTS_TABLE', 'reports');
  vi.stubEnv('ATTACHMENTS_TABLE', 'attachments');
  vi.stubEnv('MEDIA_BUCKET', 'media');
  vi.stubEnv('LINEAR_TOKEN_SECRET_NAME', 'harvest-feedback/integration/dev/linear-token');
  vi.stubEnv('APP_BASE_URL', 'https://staging.harvestbymeridian.ai/feedback');
  sdk.db.mockResolvedValue({});
  sdk.secret.mockResolvedValue({ SecretString: 'token' });
});

it('processes only assigned reports with a selected team and no existing issue', () => {
  expect(pendingLinearReport(record)).toMatchObject({ id: row.id, linearTeamId: row.linearTeamId });
  expect(pendingLinearReport({ ...record, eventName: 'INSERT' })).toBeNull();
  expect(pendingLinearReport({ ...record, dynamodb: { ...record.dynamodb, NewImage: marshall({ ...row, status: 'NEW' }) } })).toBeNull();
  expect(pendingLinearReport({ ...record, dynamodb: { ...record.dynamodb, NewImage: marshall({ ...row, linearIssueId: 'linked' }) } })).toBeNull();
  expect(pendingLinearReport({ ...record, dynamodb: { ...record.dynamodb, NewImage: marshall({ ...row, linearSyncStatus: 'FAILED' }) } })).toBeNull();
});

it('links a created issue to the report and ignores its own linked stream event', async () => {
  const issue = { id: 'issue-id', identifier: 'ENG-123', url: 'https://linear.app/withmeridian/issue/ENG-123/upload-stalls' };
  vi.mocked(createOrFindLinearIssue).mockResolvedValue(issue);
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [] });
  expect(createOrFindLinearIssue).toHaveBeenCalledWith(expect.objectContaining({ id: row.id }), 'https://staging.harvestbymeridian.ai/feedback', 'token', expect.any(Function), expect.any(Function));
  expect(sdk.db.mock.calls[0][0].input.ConditionExpression).toContain('attribute_not_exists(linearIssueId)');
  expect(sdk.db.mock.calls[0][0].input.ExpressionAttributeValues).toMatchObject({ ':id': { S: issue.id }, ':linked': { S: 'LINKED' } });
});

it('syncs owner changes on the same linked issue and ignores unrelated updates', async () => {
  const issueId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  const old = { ...row, linearIssueId: issueId, linearSyncStatus: 'LINKED' };
  const current = { ...old, linearAssigneeEmail: 'owner+admin@withmeridian.ai' };
  const change = { eventName: 'MODIFY', dynamodb: { OldImage: marshall(old), NewImage: marshall(current), SequenceNumber: 'sequence-owner' } };
  expect(linkedAssigneeChange(change)).toMatchObject({ id: row.id, linearIssueId: issueId, linearAssigneeEmail: current.linearAssigneeEmail });
  expect(linkedAssigneeChange({ ...change, dynamodb: { ...change.dynamodb, OldImage: marshall(current) } })).toBeNull();
  expect(await handler({ Records: [change] })).toEqual({ batchItemFailures: [] });
  expect(updateLinearAssignee).toHaveBeenCalledWith(issueId, current.linearAssigneeEmail, 'token');
  expect(createOrFindLinearIssue).not.toHaveBeenCalled();
  vi.mocked(updateLinearAssignee).mockRejectedValueOnce(new Error('Unavailable'));
  expect(await handler({ Records: [change] })).toEqual({ batchItemFailures: [{ itemIdentifier: 'sequence-owner' }] });
});

it('copies only a claimed immutable attachment into Linear', async () => {
  const attachment = { attachmentKey: 'feedback-media/reporter/file', attachmentName: 'recording.webm', attachmentType: 'video/webm', attachmentSize: 3 };
  sdk.db.mockResolvedValueOnce({ Item: marshall({ id: attachment.attachmentKey, reportId: row.id, versionId: 'version-1', size: 3, contentType: 'video/webm' }) });
  sdk.s3.mockResolvedValueOnce({ ContentLength: 3, ContentType: 'video/webm', Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } });
  vi.mocked(uploadLinearFile).mockResolvedValueOnce({ name: 'recording.webm', url: 'https://uploads.linear.app/file' });
  expect(await uploadReportFiles({ ...row, attachments: [attachment] } as any, 'token')).toEqual([{ name: 'recording.webm', url: 'https://uploads.linear.app/file' }]);
  expect(sdk.s3.mock.calls[0][0].input).toMatchObject({ Bucket: 'media', Key: attachment.attachmentKey, VersionId: 'version-1' });
  expect(uploadLinearFile).toHaveBeenCalledWith({ name: 'recording.webm', type: 'video/webm', bytes: new Uint8Array([1, 2, 3]) }, 'token');
});

it('refuses an attachment claimed by another report', async () => {
  const attachment = { attachmentKey: 'feedback-media/reporter/file', attachmentName: 'shot.png', attachmentType: 'image/png', attachmentSize: 3 };
  sdk.db.mockResolvedValueOnce({ Item: marshall({ id: attachment.attachmentKey, reportId: 'other', versionId: 'version-1', size: 3, contentType: 'image/png' }) });
  await expect(uploadReportFiles({ ...row, attachments: [attachment] } as any, 'token')).rejects.toThrow('unavailable');
  expect(sdk.s3).not.toHaveBeenCalled();
  expect(uploadLinearFile).not.toHaveBeenCalled();
});

it('supports a legacy single attachment and rejects changed S3 bytes', async () => {
  const legacy = { ...row, attachmentKey: 'feedback-media/reporter/old', attachmentName: 'shot.png', attachmentType: 'image/png', attachmentSize: 3 };
  sdk.db.mockResolvedValueOnce({ Item: marshall({ id: legacy.attachmentKey, reportId: row.id, versionId: 'old-version', size: 3, contentType: 'image/png' }) });
  sdk.s3.mockResolvedValueOnce({ ContentLength: 3, ContentType: 'image/png', Body: { transformToByteArray: async () => new Uint8Array([1, 2]) } });
  await expect(uploadReportFiles(legacy as any, 'token')).rejects.toThrow('changed');
  expect(uploadLinearFile).not.toHaveBeenCalled();
});

it('rejects more than five files before reading storage', async () => {
  const file = { attachmentKey: 'feedback-media/reporter/file', attachmentName: 'shot.png', attachmentType: 'image/png', attachmentSize: 3 };
  await expect(uploadReportFiles({ ...row, attachments: Array(6).fill(file) } as any, 'token')).rejects.toThrow('Too many');
  expect(sdk.db).not.toHaveBeenCalled();
});

it('marks a failure for retry and can link the same event on a later attempt', async () => {
  vi.mocked(createOrFindLinearIssue).mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValueOnce({ id: 'issue-id', identifier: 'ENG-123', url: 'https://linear.app/withmeridian/issue/ENG-123/upload-stalls' });
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [{ itemIdentifier: 'sequence-1' }] });
  expect(sdk.db.mock.calls[0][0].input.ExpressionAttributeValues[':failed']).toEqual({ S: 'FAILED' });
  expect(await handler({ Records: [record] })).toEqual({ batchItemFailures: [] });
  expect(sdk.db.mock.calls[1][0].input.ConditionExpression).toContain('linearSyncStatus IN (:pending, :failed)');
});
