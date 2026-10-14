/** Review draft only: no API handler, AWS resource or live resolver imports this module. */
import type { TransactWriteItemsCommandInput } from '@aws-sdk/client-dynamodb';

export const REPORT_NUMBER_CAPACITY = 999;
export interface Tables { registry: string; numbers: string; reports: string }
/** Resolved and authorized on the server; never accept these fields as trusted browser claims. */
export interface VerifiedOrganization { id: string; handle: string }
export interface NumberedReport {
  id: string; owner: string; organization: VerifiedOrganization; number: number;
  title: string; description: string; reporterEmail: string; reporterName: string;
  persona: 'Company' | 'Partner'; company: string; productArea: string;
  priority: 'BLOCKER' | 'BUG' | 'IMPROVEMENT'; createdAt: string;
}

export function normalizedHandle(value: string): string {
  const handle = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9-]{1,11}$/.test(handle) || handle.endsWith('-') || handle.includes('--')) {
    throw new Error('Use 2–12 letters, digits or single hyphens, starting with a letter.');
  }
  return handle;
}
function reportNumber(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > REPORT_NUMBER_CAPACITY) throw new Error('Choose an available report number from 1 to 999.');
  return String(value).padStart(3, '0');
}
export function reportReference(handle: string, number: number): string {
  return `${normalizedHandle(handle)} · #${reportNumber(number)}`;
}
function required(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required.`);
}
function permanentId(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('A permanent UUID is required.');
}

/** Two permanent claims prevent duplicate handles and any later handle change. */
export function registerHandleTransaction(registry: string, organizationId: string, chosenHandle: string): TransactWriteItemsCommandInput {
  required(organizationId, 'Verified organization ID');
  const handle = normalizedHandle(chosenHandle);
  return { TransactItems: [
    { Put: { TableName: registry, Item: { id: { S: `ORG#${organizationId}` }, organizationId: { S: organizationId }, handle: { S: handle } }, ConditionExpression: 'attribute_not_exists(id)' } },
    { Put: { TableName: registry, Item: { id: { S: `HANDLE#${handle}` }, organizationId: { S: organizationId }, handle: { S: handle } }, ConditionExpression: 'attribute_not_exists(id)' } },
  ] };
}

/** Atomically verify the permanent handle, claim one global slot, and create its UUID-backed report. */
export function createNumberedReportTransaction(tables: Tables, report: NumberedReport): TransactWriteItemsCommandInput {
  permanentId(report.id); required(report.owner, 'Authenticated owner'); required(report.organization.id, 'Verified organization ID');
  const handle = normalizedHandle(report.organization.handle), slot = reportNumber(report.number);
  const severity = { BLOCKER: 'CRITICAL', BUG: 'MEDIUM', IMPROVEMENT: 'LOW' }[report.priority];
  if (!severity) throw new Error('A valid priority is required.');
  const fields = { id: report.id, __typename: 'Feedback', owner: report.owner,
    organizationId: report.organization.id, referenceHandle: handle,
    title: report.title, description: report.description, reporterEmail: report.reporterEmail,
    reporterName: report.reporterName, persona: report.persona, company: report.company,
    productArea: report.productArea, priority: report.priority, severity,
    status: 'NEW', createdAt: report.createdAt, updatedAt: report.createdAt };
  return { TransactItems: [
    { ConditionCheck: { TableName: tables.registry, Key: { id: { S: `ORG#${report.organization.id}` } }, ConditionExpression: '#handle = :handle', ExpressionAttributeNames: { '#handle': 'handle' }, ExpressionAttributeValues: { ':handle': { S: handle } } } },
    { Put: { TableName: tables.numbers, Item: { id: { S: `NUMBER#${slot}` }, reportId: { S: report.id }, organizationId: { S: report.organization.id } }, ConditionExpression: 'attribute_not_exists(id)' } },
    { Put: { TableName: tables.reports, Item: { ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { S: value }])), referenceNumber: { N: String(report.number) } }, ConditionExpression: 'attribute_not_exists(id)' } },
  ] };
}

/** The caller must first verify live admin authorization. Close and release are one transaction. */
export function closeNumberedReportTransaction(tables: Tables, reportId: string, organization: VerifiedOrganization, number: number, timestamp: string): TransactWriteItemsCommandInput {
  permanentId(reportId); required(organization.id, 'Verified organization ID');
  const handle = normalizedHandle(organization.handle), slot = reportNumber(number);
  return { TransactItems: [
    { Update: { TableName: tables.reports, Key: { id: { S: reportId } },
      UpdateExpression: 'SET #status = :closed, adminActivityAt = :at, updatedAt = :at',
      ConditionExpression: 'attribute_exists(id) AND organizationId = :org AND referenceHandle = :handle AND referenceNumber = :number AND #status IN (:new, :assigned, :progress)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':closed': { S: 'CLOSED' }, ':at': { S: timestamp }, ':org': { S: organization.id }, ':handle': { S: handle }, ':number': { N: String(number) }, ':new': { S: 'NEW' }, ':assigned': { S: 'ASSIGNED' }, ':progress': { S: 'IN_PROGRESS' } } } },
    { Delete: { TableName: tables.numbers, Key: { id: { S: `NUMBER#${slot}` } }, ConditionExpression: 'reportId = :report AND organizationId = :org', ExpressionAttributeValues: { ':report': { S: reportId }, ':org': { S: organization.id } } } },
  ] };
}
