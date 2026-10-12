import { expect, it } from 'vitest';
import { closeNumberedReportTransaction, createNumberedReportTransaction, normalizedHandle, registerHandleTransaction, reportReference, type NumberedReport } from './draft';
const tables = { registry: 'registry', numbers: 'slots', reports: 'reports' };
const report: NumberedReport = { id: '11111111-1111-4111-8111-111111111111', owner: 'client-a::client-a', organization: { id: 'org-a', handle: 'acme' }, number: 42, title: 'Upload issue', description: 'Upload failed', reporterEmail: 'client@example.com', reporterName: 'Client', persona: 'Company', company: 'Acme', productArea: 'Data room', priority: 'BLOCKER', createdAt: '2026-10-12T12:00:00Z' };
it('normalizes case to the same unique handle and validates user-chosen handles', () => {
  expect(normalizedHandle(' acme ')).toBe('ACME');
  for (const handle of ['A', '1ACME', 'ACME-', 'AC--ME', 'AC ME', 'TOO-LONG-HANDLE']) expect(() => normalizedHandle(handle)).toThrow();
  expect(registerHandleTransaction('registry', 'org-a', 'acme')).toEqual(registerHandleTransaction('registry', 'org-a', ' ACME '));
});
it('claims both handle uniqueness and organization immutability together', () => {
  const tx = registerHandleTransaction('registry', 'org-a', 'ACME');
  expect(tx.TransactItems).toHaveLength(2);
  expect(tx.TransactItems?.map(item => item.Put?.ConditionExpression)).toEqual(['attribute_not_exists(id)', 'attribute_not_exists(id)']);
  expect(tx.TransactItems?.[0].Put?.Item?.id).toEqual({ S: 'ORG#org-a' });
  expect(tx.TransactItems?.[1].Put?.Item?.id).toEqual({ S: 'HANDLE#ACME' });
});
it('uses a global slot independently of company names and retains permanent identity', () => {
  const first = createNumberedReportTransaction(tables, report);
  const second = createNumberedReportTransaction(tables, { ...report, id: '22222222-2222-4222-8222-222222222222', organization: { id: 'org-b', handle: 'acme-west' } });
  expect(first.TransactItems?.[1].Put?.Item?.id).toEqual(second.TransactItems?.[1].Put?.Item?.id);
  expect(first.TransactItems?.[1].Put?.ConditionExpression).toBe('attribute_not_exists(id)');
  expect(first.TransactItems?.[2].Put?.Item?.id).toEqual({ S: report.id });
  expect(first.TransactItems?.[2].Put?.Item?.severity).toEqual({ S: 'CRITICAL' });
  expect(reportReference('acme', 42)).toBe('ACME · #042');
});
it('prevents a stale closure from releasing a number now owned by another report', () => {
  const tx = closeNumberedReportTransaction(tables, report.id, report.organization, 42, report.createdAt);
  expect(tx.TransactItems).toHaveLength(2);
  expect(tx.TransactItems?.[1].Delete?.ConditionExpression).toBe('reportId = :report AND organizationId = :org');
  expect(tx.TransactItems?.[1].Delete?.ExpressionAttributeValues?.[':report']).toEqual({ S: report.id });
  expect(tx.TransactItems?.[0].Update?.UpdateExpression).not.toContain('referenceNumber =');
});
it('rejects unusable numbers and display references masquerading as internal IDs', () => {
  for (const number of [0, 1000, 1.5, NaN]) expect(() => createNumberedReportTransaction(tables, { ...report, number })).toThrow();
  expect(() => createNumberedReportTransaction(tables, { ...report, id: 'ACME · #042' })).toThrow('UUID');
});
