import { expect, it } from 'vitest';
import { ACCEPT, checkFile } from './file';
const max = 50 * 1024 * 1024;
it.each(ACCEPT.split(','))('accepts %s at the inclusive boundary', type => { expect(checkFile({ type, size: max, name: 'file' }, max)).toBeNull(); });
it('rejects oversize, unknown type, and conflicting mime; accepts an empty MIME with an allowed extension', () => {
  expect(checkFile({ size: max + 1, type: 'image/png', name: 'x.png' }, max)).toBe('Choose a file smaller than 50 MB.');
  expect(checkFile({ size: 1, type: 'text/html', name: 'x.png' }, max)).toContain('Choose a PNG');
  expect(checkFile({ size: 1, type: '', name: 'x.exe' }, max)).toContain('Choose a PNG');
  expect(checkFile({ size: 1, type: '', name: 'x.MOV' }, max)).toBeNull();
});
