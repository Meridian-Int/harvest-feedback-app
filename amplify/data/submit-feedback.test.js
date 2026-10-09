import { beforeEach, expect, it, vi } from 'vitest';
import { request, response } from './submit-feedback.js';

const helpers = vi.hoisted(() => ({ error: vi.fn(), autoId: vi.fn(), nowISO8601: vi.fn(), put: vi.fn() }));
vi.mock('@aws-appsync/utils', () => ({ util: {
  error: helpers.error,
  autoId: helpers.autoId,
  time: { nowISO8601: helpers.nowISO8601 },
} }));
vi.mock('@aws-appsync/utils/dynamodb', () => ({ put: helpers.put }));

function context(overrides = {}) {
  return {
    identity: {
      sub: 'user-1', username: 'client@company.com',
      claims: { email: 'client@company.com', name: 'Client', 'custom:clientPersona': 'Company', 'custom:persona': 'Company', 'custom:company': 'Company' },
    },
    args: { description: '  Report title\nMore detail  ', productArea: 'Data room', priority: 'BUG', severity: 'MEDIUM' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  helpers.error.mockImplementation((message, name) => { throw Object.assign(new Error(message), { name }); });
  helpers.autoId.mockReturnValue('generated-id');
  helpers.nowISO8601.mockReturnValue('2026-10-09T12:00:00.000Z');
  helpers.put.mockImplementation(value => value);
});

it('sets required status, title, owner and reporter details on the server', () => {
  const ctx = context({ args: { ...context().args, title: 'spoofed', status: 'CLOSED', reporterEmail: 'spoof@example.com' } });
  const result = request(ctx);
  expect(result.key).toEqual({ id: 'generated-id' });
  expect(result.item).toMatchObject({
    id: 'generated-id', title: 'Report title', description: 'Report title\nMore detail', status: 'NEW',
    reporterName: 'Client', reporterEmail: 'client@company.com', persona: 'Company', company: 'Company',
    owner: 'user-1::client@company.com', createdAt: '2026-10-09T12:00:00.000Z', updatedAt: '2026-10-09T12:00:00.000Z',
  });
  expect(result.condition).toEqual({ id: { attributeExists: false } });
});

it('accepts a named Other area and an admin Sentry link', () => {
  const ctx = context();
  ctx.identity.claims['cognito:groups'] = ['admins'];
  ctx.args.productArea = 'Other — add an area';
  ctx.args.customArea = '  Agreements  ';
  ctx.args.sentryIssueId = 'issue-1';
  expect(request(ctx).item).toMatchObject({ customArea: 'Agreements', sentryIssueId: 'issue-1' });
});

it('rejects a Sentry link from a client', () => {
  const ctx = context();
  ctx.args.sentryIssueId = 'issue-1';
  expect(() => request(ctx)).toThrow('Admin access required.');
});

it.each([
  [{ description: ' ' }, 'describe'],
  [{ description: 'x'.repeat(3001) }, '3000'],
  [{ productArea: 'Unknown' }, 'product area'],
  [{ productArea: 'Other — add an area' }, 'name'],
  [{ productArea: 'Other — add an area', customArea: 'x'.repeat(81) }, '80'],
])('rejects invalid input %o at the server', (overrides, message) => {
  const ctx = context();
  Object.assign(ctx.args, overrides);
  expect(() => request(ctx)).toThrow(message);
  expect(helpers.put).not.toHaveBeenCalled();
});

it('requires a complete signed-in Cognito profile', () => {
  const ctx = context();
  delete ctx.identity.claims['custom:company'];
  expect(() => request(ctx)).toThrow('profile is incomplete');
});

it('requires consistent attachment metadata within the size limit', () => {
  const ctx = context();
  Object.assign(ctx.args, { attachmentKey: 'feedback-media/identity-1/file', attachmentName: 'capture.png', attachmentType: 'image/png', attachmentSize: 5 });
  ctx.stash = { verifiedAttachmentKey: ctx.args.attachmentKey };
  expect(request(ctx).item).toMatchObject({ attachmentSize: 5, attachmentName: 'capture.png' });
  ctx.args.attachmentSize = 50 * 1024 * 1024 + 1;
  expect(() => request(ctx)).toThrow('Attachment unavailable.');
});

it('rejects an attachment unless the server verified this exact key', () => {
  const ctx = context();
  Object.assign(ctx.args, { attachmentKey: 'feedback-media/another-client/file', attachmentName: 'capture.png', attachmentType: 'image/png', attachmentSize: 5 });
  expect(() => request(ctx)).toThrow('Attachment unavailable.');
  ctx.stash = { verifiedAttachmentKey: 'feedback-media/identity-1/file' };
  expect(() => request(ctx)).toThrow('Attachment unavailable.');
  expect(helpers.put).not.toHaveBeenCalled();
});

it('passes a successful DynamoDB result through and surfaces write errors', () => {
  const ctx = { result: { id: 'generated-id' }, stash: {} };
  expect(response(ctx)).toEqual({ id: 'generated-id' });
  expect(ctx.stash.submittedFeedback).toEqual({ id: 'generated-id' });
  expect(() => response({ error: { message: 'Write failed', type: 'DynamoDBError' } })).toThrow('Write failed');
});

it('uses account persona and ignores caller attempts to change classification', () => {
  const ctx = context();
  ctx.args.persona = 'Partner';
  expect(request(ctx).item).toMatchObject({ persona: 'Company', reporterEmail: 'client@company.com', owner: 'user-1::client@company.com', status: 'NEW' });
});
it.each(['Payment — payout status or delay', 'Payment — amount or calculation', 'Payment — failed or missing payout', 'Payment — confirmation or receipt'])('rejects a removed payment area %s', productArea => {
  const ctx = context(); ctx.args.productArea = productArea;
  expect(() => request(ctx)).toThrow('Please choose a product area.');
  expect(helpers.put).not.toHaveBeenCalled();
});
it('accepts payment account setup', () => {
  const ctx = context(); ctx.args.productArea = 'Payment — payout account setup';
  expect(request(ctx).item.productArea).toBe('Payment — payout account setup');
});
