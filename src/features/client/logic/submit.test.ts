import { expect, it, vi } from 'vitest';
import { choices, makeApi } from '../testing/support';
import { submitFeedback } from './submit';
import { emptyDraft } from './form';
const draft = { ...emptyDraft(), productArea: 'Data room', priority: 'BUG', severity: 'LOW', description: '  Something failed  ' };
const png = (name = 'image.png') => new File(['x'], name, { type: 'image/png' });
it('validates before any API call, including file checks and the file limit', async () => {
  const api = makeApi();
  await expect(submitFeedback(api, choices, emptyDraft(), [])).rejects.toThrow('Please');
  await expect(submitFeedback(api, choices, draft, [new File(['x'], 'bad.txt', { type: 'text/plain' })])).rejects.toThrow('Choose a PNG');
  await expect(submitFeedback(api, choices, draft, Array.from({ length: 6 }, (_, i) => png(`${i}.png`)))).rejects.toThrow('up to 5 files');
  expect(api.uploadAttachment).not.toHaveBeenCalled(); expect(api.createFeedback).not.toHaveBeenCalled();
});
it('uploads every file then creates, without browser-supplied reporter/status fields', async () => {
  const api = makeApi();
  vi.mocked(api.uploadAttachment).mockImplementation(async file => ({ attachmentKey: `feedback-media/test/${file.name}`, attachmentName: file.name, attachmentType: file.type, attachmentSize: file.size }));
  await submitFeedback(api, choices, draft, [png('one.png'), png('two.png')]);
  expect(vi.mocked(api.uploadAttachment).mock.invocationCallOrder[1]).toBeLessThan(vi.mocked(api.createFeedback).mock.invocationCallOrder[0]);
  const input = vi.mocked(api.createFeedback).mock.calls[0][0];
  expect(input).toMatchObject({ title: 'Something failed' });
  expect(input.attachments?.map(file => file.attachmentKey)).toEqual(['feedback-media/test/one.png', 'feedback-media/test/two.png']);
  expect(input).not.toHaveProperty('reporterEmail'); expect(input).not.toHaveProperty('status');
});
it('supports no file and compensates for a failed create or a failed upload', async () => {
  const api = makeApi(); await submitFeedback(api, choices, draft, []); expect(api.uploadAttachment).not.toHaveBeenCalled();
  expect(vi.mocked(api.createFeedback).mock.calls[0][0]).not.toHaveProperty('attachments');
  vi.mocked(api.createFeedback).mockRejectedValue(Error('failed'));
  await expect(submitFeedback(api, choices, draft, [png()])).rejects.toThrow('failed');
  expect(api.removeAttachment).toHaveBeenCalledWith('feedback-media/test/file');
  vi.mocked(api.removeAttachment).mockClear();
  vi.mocked(api.uploadAttachment).mockResolvedValueOnce({ attachmentKey: 'feedback-media/test/ok', attachmentName: 'ok.png', attachmentType: 'image/png', attachmentSize: 1 }).mockRejectedValueOnce(Error('upload failed'));
  await expect(submitFeedback(api, choices, draft, [png('ok.png'), png('bad.png')])).rejects.toThrow('upload failed');
  expect(api.removeAttachment).toHaveBeenCalledWith('feedback-media/test/ok');
  vi.mocked(api.removeAttachment).mockRejectedValue(Error('denied'));
  await expect(submitFeedback(api, choices, draft, [png()])).rejects.toThrow('could not be removed');
});
