import { beforeEach, expect, it, vi } from 'vitest';
import { request, response } from './verify-attachment.js';
const mocks = vi.hoisted(() => ({ earlyReturn: vi.fn(), error: vi.fn() }));
vi.mock('@aws-appsync/utils', () => ({ runtime: { earlyReturn: mocks.earlyReturn }, util: { error: mocks.error } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.earlyReturn.mockImplementation(() => { throw new Error('skip'); });
  mocks.error.mockImplementation(message => { throw new Error(message); });
});
it('skips attachment verification when no attachment was submitted', () => {
  expect(() => request({ args: {} })).toThrow('skip');
  expect(mocks.earlyReturn).toHaveBeenCalledWith(null);
});
it('passes server identity and authorization header, never an argument-supplied identity', () => {
  const ctx = { identity: { sub: 'client-a' }, request: { headers: { authorization: 'id-token' } }, args: { attachmentKey: 'file', identity: { sub: 'client-b' } } };
  expect(request(ctx)).toMatchObject({ operation: 'Invoke', payload: { identity: { sub: 'client-a' }, token: 'id-token', attachment: { attachmentKey: 'file' } } });
});
it('only stores the exact verified attachment key and blocks failures', () => {
  const ctx = { args: { attachmentKey: 'file' }, result: { attachmentKey: 'file' }, stash: {} };
  response(ctx); expect(ctx.stash.verifiedAttachmentKey).toBe('file');
  for (const patch of [{ error: { message: 'internal error' } }, { result: null }, { result: { attachmentKey: 'different' } }]) {
    expect(() => response({ ...ctx, stash: {}, ...patch })).toThrow('Attachment unavailable.');
  }
});
it('verifies every file in the attachments list together with the legacy fields', () => {
  const first = { attachmentKey: 'a', attachmentName: 'a.png', attachmentType: 'image/png', attachmentSize: 1 };
  const second = { attachmentKey: 'b', attachmentName: 'b.png', attachmentType: 'image/png', attachmentSize: 2 };
  const ctx = { identity: { sub: 'client-a' }, request: { headers: { authorization: 'id-token' } }, args: { ...first, attachments: JSON.stringify([second]) } };
  expect(request(ctx).payload.attachments).toEqual([first, second]);
  const verified = { args: ctx.args, result: { attachmentKey: 'a', attachmentKeys: ['a', 'b'] }, stash: {} };
  response(verified); expect(verified.stash.verifiedAttachmentKeys).toEqual(['a', 'b']);
  expect(() => response({ ...verified, stash: {}, result: { attachmentKeys: ['a'] } })).toThrow('Attachment unavailable.');
  expect(() => request({ ...ctx, args: { attachments: Array.from({ length: 6 }, () => second) } })).toThrow('Attachment unavailable.');
});
