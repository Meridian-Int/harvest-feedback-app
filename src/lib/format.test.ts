import { displayId, formatDate, formatDateTime, formatFileSize, titleFromDescription } from './format';

it('formats the last four characters as the display ID', () => { expect(displayId('1234-abcdef')).toBe('FB-CDEF'); });
it('derives a trimmed first-line title with a 110 character limit', () => {
  expect(titleFromDescription('  First line  \r\nSecond line')).toBe('First line');
  expect(titleFromDescription('x'.repeat(150))).toHaveLength(110);
  expect(titleFromDescription('  ')).toBe('');
});
it('formats dates and times using an explicit locale and tolerates invalid dates', () => {
  expect(formatDate('2026-10-08T12:00:00', 'en-US')).toBe('Oct 8');
  expect(formatDateTime('2026-10-08T12:00:00', 'en-US')).toMatch(/10\/8\/2026/);
  expect(formatDate('bad')).toBe('—'); expect(formatDateTime('bad')).toBe('—');
});
it('formats file sizes', () => { expect(formatFileSize(0)).toBe('1 KB'); expect(formatFileSize(2048)).toBe('2 KB'); expect(formatFileSize(1572864)).toBe('1.5 MB'); });
