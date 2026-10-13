import { randomUUID } from 'node:crypto';
import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, ScanCommand, UpdateItemCommand, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authorize, organization, canRead, requireReport, updateFields, type Event } from './authorization';
import { PRODUCT_AREAS, MAX_ATTACHMENT_BYTES } from '../src/lib/options';
import { selectedAdministrators } from './administrators';

const db = new DynamoDBClient({});
const s3 = new S3Client({});
const table = (name: string) => { const value = process.env[name]; if (!value) throw new Error('Backend configuration missing.'); return value; };
const item = (value: Record<string, any>) => marshall(value, { removeUndefinedValues: true });
const get = async (name: string, id: string) => {
  const result = await db.send(new GetItemCommand({ TableName: table(name), Key: item({ id }), ConsistentRead: true }));
  return result.Item ? unmarshall(result.Item) : null;
};
const timestamp = () => new Date().toISOString();
const safeId = (value: unknown): string => { if (typeof value !== 'string' || !value || value.length > 1024) throw new Error('Invalid identifier.'); return value; };
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']);

export async function handler(event: Event) {
  // No privileged operation exists before this fresh, fail-closed membership lookup.
  const actor = await authorize(event, async sub => get('ADMINS_TABLE', sub));
  const args = event.arguments;
  const operation = event.info.fieldName;
  if (operation === 'harvestViewer') return { ...actor.viewer, feedbackAdmin: actor.admin };
  if (operation === 'feedbackAdministrators') {
    if (!actor.admin) throw new Error('Admin access required.');
    return selectedAdministrators();
  }
  if (operation === 'sentryIssues') {
    if (!actor.admin) throw new Error('Admin access required.');
    return { configured: false, issues: [] };
  }
  if (operation === 'listFeedbacks' || operation === 'listNotificationReads') {
    const reports = operation === 'listFeedbacks';
    const limit = Math.max(1, Math.min(Number(args.limit) || 100, 100));
    let start: Record<string, any> | undefined;
    if (args.nextToken) {
      try { start = JSON.parse(Buffer.from(String(args.nextToken), 'base64url').toString()); }
      catch { throw new Error('Invalid page token.'); }
      // A cursor can move a page boundary, never alter the query's subject or filter.
      if (!start || typeof start.id !== 'string') throw new Error('Invalid page token.');
    }
    const name = table(reports ? 'REPORTS_TABLE' : 'READS_TABLE');
    const result = reports && actor.admin
      ? await db.send(new ScanCommand({ TableName: name, Limit: limit, ExclusiveStartKey: start ? item(start) : undefined, ConsistentRead: true }))
      : await db.send(new QueryCommand({ TableName: name, IndexName: 'byOwner', KeyConditionExpression: '#owner = :sub', ExpressionAttributeNames: { '#owner': 'owner' }, ExpressionAttributeValues: item({ ':sub': actor.sub }), Limit: limit, ExclusiveStartKey: start ? item(start) : undefined }));
    const rows = (result.Items ?? []).map(value => unmarshall(value));
    return { items: reports ? rows.filter(row => canRead(actor, row)) : rows.filter(row => row.owner === actor.sub), nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(unmarshall(result.LastEvaluatedKey))).toString('base64url') : null };
  }
  if (operation === 'getFeedback') {
    const report = await get('REPORTS_TABLE', safeId(args.id));
    requireReport(actor, report);
    return report;
  }
  if (operation === 'getNotificationRead') {
    const receipt = await get('READS_TABLE', safeId(args.id));
    return receipt?.owner === actor.sub ? receipt : null;
  }
  if (operation === 'createNotificationRead') {
    const eventId = safeId(args.input.eventId);
    const id = `${actor.sub}::${eventId}`;
    if (args.input.id !== id) throw new Error('Unauthorized');
    const receipt = { id, eventId, owner: actor.sub };
    await db.send(new PutItemCommand({ TableName: table('READS_TABLE'), Item: item(receipt) }));
    return receipt;
  }
  if (operation === 'updateFeedback') {
    const id = safeId(args.input.id);
    const report = await get('REPORTS_TABLE', id);
    requireReport(actor, report);
    const owners = actor.admin && args.input.assignee && args.input.assignee !== 'admin@example.com'
      ? (await selectedAdministrators()).map(admin => admin.sub) : [];
    const changes = updateFields(actor, report as any, args.input, Date.now(), owners);
    if (!Object.keys(changes).length) return report;
    const update = { ...changes, updatedAt: timestamp(), revision: Number(report!.revision ?? 0) + 1 };
    const entries = Object.entries(update);
    const result = await db.send(new UpdateItemCommand({
      TableName: table('REPORTS_TABLE'), Key: item({ id }),
      UpdateExpression: `SET ${entries.map((_, i) => `#f${i} = :v${i}`).join(', ')}`,
      ConditionExpression: 'revision = :revision',
      ExpressionAttributeNames: Object.fromEntries(entries.map(([key], i) => [`#f${i}`, key])),
      ExpressionAttributeValues: item({ ...Object.fromEntries(entries.map(([, value], i) => [`:v${i}`, value])), ':revision': report!.revision }),
      ReturnValues: 'ALL_NEW',
    }));
    return unmarshall(result.Attributes!);
  }
  if (operation === 'prepareAttachment') {
    const org = organization(actor, args.organizationId);
    if (!TYPES.has(args.contentType) || !Number.isInteger(args.size) || args.size < 1 || args.size > MAX_ATTACHMENT_BYTES || typeof args.name !== 'string' || args.name.length > 255) throw new Error('Invalid attachment.');
    const key = `feedback-media/${actor.sub}/${randomUUID()}`;
    const pending = { id: key, owner: actor.sub, organizationId: org.orgId, contentType: args.contentType, size: args.size, name: args.name, expiresAt: Math.floor(Date.now() / 1000) + 86400 };
    await db.send(new PutItemCommand({ TableName: table('ATTACHMENTS_TABLE'), Item: item(pending), ConditionExpression: 'attribute_not_exists(id)' }));
    const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: table('MEDIA_BUCKET'), Key: key, ContentType: args.contentType, ContentLength: args.size }), { expiresIn: 60 });
    return { key, url, size: args.size, contentType: args.contentType };
  }
  if (operation === 'attachmentAccess' || operation === 'removeAttachment') {
    const key = safeId(args.key);
    const upload = await get('ATTACHMENTS_TABLE', key);
    if (!upload) throw new Error('Attachment unavailable.');
    if (upload.reportId) {
      requireReport(actor, await get('REPORTS_TABLE', upload.reportId));
      if (operation === 'removeAttachment') throw new Error('Attachment is already linked to a report.');
    } else if (upload.owner !== actor.sub || !actor.viewer.memberships.some(m => m.orgId === upload.organizationId)) throw new Error('Attachment unavailable.');
    if (operation === 'removeAttachment') {
      // Claim and deletion contend on the same item. Never remove a claimed object.
      await db.send(new UpdateItemCommand({ TableName: table('ATTACHMENTS_TABLE'), Key: item({ id: key }), UpdateExpression: 'SET deleted = :true', ConditionExpression: 'attribute_not_exists(reportId)', ExpressionAttributeValues: item({ ':true': true }) }));
      await s3.send(new DeleteObjectCommand({ Bucket: table('MEDIA_BUCKET'), Key: key }));
      return true;
    }
    if (upload.deleted) throw new Error('Attachment unavailable.');
    const version = upload.versionId;
    const head = await s3.send(new HeadObjectCommand({ Bucket: table('MEDIA_BUCKET'), Key: key, VersionId: version }));
    if (args.operation === 'HEAD') return { key, size: head.ContentLength, contentType: head.ContentType };
    if (args.operation !== 'GET' || !upload.reportId) throw new Error('Attachment unavailable.');
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: table('MEDIA_BUCKET'), Key: key, VersionId: version }), { expiresIn: 60 });
    return { key, url, size: head.ContentLength, contentType: head.ContentType };
  }
  if (operation === 'submitFeedback') {
    const org = organization(actor, args.organizationId);
    const description = typeof args.description === 'string' ? args.description.trim() : '';
    const severity = ({ BLOCKER: 'CRITICAL', BUG: 'MEDIUM', IMPROVEMENT: 'LOW' } as Record<string, string>)[args.priority];
    const customArea = typeof args.customArea === 'string' ? args.customArea.trim() : '';
    if (!description || description.length > 3000 || !PRODUCT_AREAS.includes(args.productArea) || !severity ||
        (args.productArea === 'Other — add an area' && (!customArea || customArea.length > 80))) throw new Error('Invalid feedback.');
    if (args.sentryIssueId && !actor.admin) throw new Error('Admin access required.');
    const now = timestamp();
    const report: Record<string, any> = { id: randomUUID(), title: description.split('\n')[0].slice(0, 110), description, productArea: args.productArea, ...(customArea ? { customArea } : {}), priority: args.priority, severity, reporterName: actor.viewer.person.name ?? actor.viewer.person.email, reporterEmail: actor.viewer.person.email, persona: org.orgKind === 'company' ? 'Company' : org.orgKind === 'partner' ? 'Partner' : 'Operator', company: org.orgName, organizationId: org.orgId, owner: actor.sub, status: 'NEW', assignee: 'admin@example.com', createdAt: now, updatedAt: now, revision: 0, ...(args.sentryIssueId ? { sentryIssueId: args.sentryIssueId } : {}) };
    const writes: any[] = [{ Put: { TableName: table('REPORTS_TABLE'), Item: item(report), ConditionExpression: 'attribute_not_exists(id)' } }];
    if (args.attachmentKey) {
      const key = safeId(args.attachmentKey);
      const upload = await get('ATTACHMENTS_TABLE', key);
      if (!upload || upload.owner !== actor.sub || upload.organizationId !== org.orgId || upload.reportId || upload.deleted || upload.expiresAt <= Date.now() / 1000) throw new Error('Attachment unavailable.');
      const head = await s3.send(new HeadObjectCommand({ Bucket: table('MEDIA_BUCKET'), Key: key }));
      if (head.ContentLength !== upload.size || head.ContentType !== upload.contentType || !head.VersionId) throw new Error('Attachment unavailable.');
      Object.assign(report, { attachmentKey: key, attachmentName: upload.name, attachmentType: upload.contentType, attachmentSize: head.ContentLength });
      writes[0].Put.Item = item(report);
      writes.push({ Update: { TableName: table('ATTACHMENTS_TABLE'), Key: item({ id: key }), UpdateExpression: 'SET reportId = :report, versionId = :version REMOVE expiresAt', ConditionExpression: 'attribute_not_exists(reportId) AND attribute_not_exists(deleted)', ExpressionAttributeValues: item({ ':report': report.id, ':version': head.VersionId }) } });
    }
    await db.send(new TransactWriteItemsCommand({ TransactItems: writes }));
    return report;
  }
  throw new Error('Unsupported operation.');
}
