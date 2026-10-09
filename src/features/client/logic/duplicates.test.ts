import { expect, it } from 'vitest';
import { findDuplicates, significantWords } from './duplicates';
import { makeReport } from '../testing/support';

it('normalizes tokens exactly like the handoff', () => {
  expect([...significantWords('THE Download, download 42 failed! signed-document')]).toEqual(['download', 'failed', 'signed', 'document']);
  expect(significantWords('')).toHaveProperty('size', 0);
});
it('requires three significant/shared words, a matching area, and score >= 0.4', () => {
  const report = makeReport({ title: 'alpha beta gamma delta epsilon zeta eta theta', description: '' });
  expect(findDuplicates('alpha beta', 'Data room', [report])).toEqual([]);
  expect(findDuplicates('alpha beta other', 'Data room', [report])).toEqual([]);
  expect(findDuplicates('alpha beta gamma phi chi psi tau upsilon', 'Data room', [report])).toEqual([]);
  expect(findDuplicates('alpha beta gamma fourth fifth', 'Data room', [report])).toEqual([report]);
  expect(findDuplicates('alpha beta gamma', 'Other', [report])).toEqual([]);
  expect(findDuplicates('alpha beta gamma', '', [report])).toEqual([]);
});
it('uses only supplied owner candidates and returns the best three; matches custom areas', () => {
  const mine = Array.from({ length: 5 }, (_, index) => makeReport({ id: String(index), productArea: 'Other', customArea: 'Alerts' }));
  expect(findDuplicates('download fails signed document', 'Alerts', mine).map(r => r.id)).toEqual(['0', '1', '2']);
  expect(findDuplicates('download fails signed document', 'Alerts', [])).toEqual([]);
});
