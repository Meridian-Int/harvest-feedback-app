import { expect, it, vi } from 'vitest';
import { choices } from '../testing/support';
import { clearDraft, draftKey, readDraft, saveDraft } from './draft';
import { emptyDraft } from './form';

it('round-trips only draft fields, isolates accounts, and clears', () => {
  const draft = { ...emptyDraft(), description: 'hello', productArea: 'Data room', file: 'bytes', reporterEmail: 'private' };
  expect(saveDraft(localStorage, 'a', draft)).toBe(true);
  expect(localStorage.getItem(draftKey('a'))).not.toMatch(/bytes|reporterEmail|private/);
  expect(readDraft(localStorage, 'a', choices).description).toBe('hello');
  expect(readDraft(localStorage, 'b', choices)).toEqual(emptyDraft());
  expect(clearDraft(localStorage, 'a')).toBe(true);
  expect(readDraft(localStorage, 'a', choices)).toEqual(emptyDraft());
});
it.each(['{', 'null', '{}', '{"version":2,"fields":{}}', '{"version":1,"fields":null}'])('ignores invalid/old draft %s', value => {
  localStorage.setItem(draftKey('a'), value); expect(readDraft(localStorage, 'a', choices)).toEqual(emptyDraft());
});
it('bounds text and ignores renamed options and non-string text', () => {
  localStorage.setItem(draftKey('a'), JSON.stringify({ version: 1, fields: { productArea: 'removed', priority: 'BUG', severity: 'OLD', customArea: 12, description: 'x'.repeat(3100) } }));
  expect(readDraft(localStorage, 'a', choices)).toMatchObject({ productArea: '', priority: 'BUG', severity: '', customArea: '' });
  expect(readDraft(localStorage, 'a', choices).description).toHaveLength(3000);
});
it('handles storage denial without crashing', () => {
  const denied = { getItem: vi.fn(() => { throw Error(); }), setItem: vi.fn(() => { throw Error(); }), removeItem: vi.fn(() => { throw Error(); }) };
  expect(readDraft(denied, 'a', choices)).toEqual(emptyDraft());
  expect(saveDraft(denied, 'a', emptyDraft())).toBe(false);
  expect(clearDraft(denied, 'a')).toBe(false);
});
