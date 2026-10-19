import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from '../src/lib/options';
import { createOrFindLinearIssue, uploadLinearFile, type LinearReport, type LinearUploadedFile } from './linear';

const db = new DynamoDBClient({});
const s3 = new S3Client({});
const secrets = new SecretsManagerClient({});
let cachedToken: { value: string; until: number } | undefined;

type Image = Record<string, { S?: string; N?: string; BOOL?: boolean; NULL?: boolean; M?: Image; L?: unknown[] }>;
type StreamRecord = { eventName?: string; dynamodb?: { NewImage?: Image; SequenceNumber?: string } };

export function pendingLinearReport(record: StreamRecord): (LinearReport & { linearSyncStatus: 'PENDING' }) | null {
  if (record.eventName !== 'MODIFY' || !record.dynamodb?.NewImage) return null;
  const row = unmarshall(record.dynamodb.NewImage as Parameters<typeof unmarshall>[0]);
  if (!['ASSIGNED', 'IN_PROGRESS'].includes(row.status) || !row.linearTeamId || row.linearIssueId || row.linearSyncStatus !== 'PENDING') return null;
  return row as LinearReport & { linearSyncStatus: 'PENDING' };
}

async function linearToken(): Promise<string> {
  const name = process.env.LINEAR_TOKEN_SECRET_NAME;
  if (!name) throw new Error('Linear is not configured.');
  if (!cachedToken || cachedToken.until <= Date.now()) {
    const value = (await secrets.send(new GetSecretValueCommand({ SecretId: name }))).SecretString;
    if (!value) throw new Error('Linear token is unavailable.');
    cachedToken = { value, until: Date.now() + 300_000 };
  }
  return cachedToken.value;
}

const fileTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']);

/** Read the immutable S3 versions claimed when the client submitted this report. */
export async function uploadReportFiles(report: LinearReport, token: string): Promise<LinearUploadedFile[]> {
  const files = report.attachments?.length ? report.attachments : report.attachmentKey ? [{
    attachmentKey: report.attachmentKey, attachmentName: report.attachmentName ?? '',
    attachmentType: report.attachmentType ?? '', attachmentSize: report.attachmentSize ?? 0,
  }] : [];
  if (files.length > MAX_ATTACHMENTS) throw new Error('Too many Feedback attachments.');
  const uploaded: LinearUploadedFile[] = [];
  for (const file of files) {
    if (!file.attachmentKey?.startsWith('feedback-media/') || !file.attachmentName || file.attachmentName.length > 255 ||
        !fileTypes.has(file.attachmentType) || !Number.isInteger(file.attachmentSize) || file.attachmentSize < 1 || file.attachmentSize > MAX_ATTACHMENT_BYTES) throw new Error('Invalid Feedback attachment.');
    const metadata = await db.send(new GetItemCommand({ TableName: process.env.ATTACHMENTS_TABLE, Key: marshall({ id: file.attachmentKey }), ConsistentRead: true }));
    const claimed = metadata.Item ? unmarshall(metadata.Item) : null;
    if (!claimed || claimed.reportId !== report.id || !claimed.versionId || claimed.deleted || claimed.size !== file.attachmentSize || claimed.contentType !== file.attachmentType) throw new Error('Feedback attachment is unavailable.');
    const object = await s3.send(new GetObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: file.attachmentKey, VersionId: claimed.versionId }));
    if (!object.Body || object.ContentLength !== file.attachmentSize || object.ContentType !== file.attachmentType) throw new Error('Feedback attachment changed.');
    const bytes = await object.Body.transformToByteArray();
    if (bytes.byteLength !== file.attachmentSize) throw new Error('Feedback attachment changed.');
    uploaded.push(await uploadLinearFile({ name: file.attachmentName, type: file.attachmentType, bytes }, token));
  }
  return uploaded;
}

async function markFailed(report: LinearReport) {
  await db.send(new UpdateItemCommand({
    TableName: process.env.REPORTS_TABLE,
    Key: marshall({ id: report.id }),
    UpdateExpression: 'SET linearSyncStatus = :failed',
    ConditionExpression: 'linearTeamId = :team AND linearSyncStatus = :pending AND attribute_not_exists(linearIssueId)',
    ExpressionAttributeValues: marshall({ ':failed': 'FAILED', ':team': report.linearTeamId, ':pending': 'PENDING' }),
  })).catch(() => { /* A concurrent delivery may already have linked the issue. */ });
}

export async function handler(event: { Records: StreamRecord[] }) {
  const failures: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records) {
    const report = pendingLinearReport(record);
    if (!report) continue;
    try {
      const token = await linearToken();
      const issue = await createOrFindLinearIssue(report, process.env.APP_BASE_URL ?? '', token, fetch, () => uploadReportFiles(report, token));
      try {
        await db.send(new UpdateItemCommand({
          TableName: process.env.REPORTS_TABLE,
          Key: marshall({ id: report.id }),
          UpdateExpression: 'SET linearIssueId = :id, linearIssueIdentifier = :identifier, linearIssueUrl = :url, linearSyncStatus = :linked',
          ConditionExpression: 'linearTeamId = :team AND linearSyncStatus IN (:pending, :failed) AND attribute_not_exists(linearIssueId)',
          ExpressionAttributeValues: marshall({ ':id': issue.id, ':identifier': issue.identifier, ':url': issue.url, ':linked': 'LINKED', ':team': report.linearTeamId, ':pending': 'PENDING', ':failed': 'FAILED' }),
        }));
      } catch (error) {
        const current = await db.send(new GetItemCommand({ TableName: process.env.REPORTS_TABLE, Key: marshall({ id: report.id }), ConsistentRead: true }));
        if (!current.Item || unmarshall(current.Item).linearIssueId !== issue.id) throw error;
      }
    } catch {
      await markFailed(report);
      if (!record.dynamodb?.SequenceNumber) throw new Error('Linear stream event has no retry identity.');
      failures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }
  return { batchItemFailures: failures };
}
