import { expect, it, vi } from 'vitest';
import { choices, makeApi } from '../testing/support';
import { submitFeedback } from './submit';
import { emptyDraft } from './form';
const draft = { ...emptyDraft(), productArea: 'Data room', priority: 'BUG', severity: 'LOW', description: '  Something failed  ' };
it('validates before any API call, including file checks', async () => {
  const api = makeApi();
  await expect(submitFeedback(api, choices, emptyDraft(), null)).rejects.toThrow('Please');
  await expect(submitFeedback(api, choices, draft, new File(['x'], 'bad.txt', { type: 'text/plain' }))).rejects.toThrow('Choose a PNG');
  expect(api.uploadAttachment).not.toHaveBeenCalled(); expect(api.createFeedback).not.toHaveBeenCalled();
});
it('uploads then creates, without browser-supplied reporter/status fields', async () => {
  const api = makeApi();
  await submitFeedback(api, choices, draft, new File(['x'], 'image.png', { type: 'image/png' }));
  expect(vi.mocked(api.uploadAttachment).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(api.createFeedback).mock.invocationCallOrder[0]);
  expect(api.createFeedback).toHaveBeenCalledWith(expect.objectContaining({ title: 'Something failed', attachmentKey: 'feedback-media/test/file' }));
  const input = vi.mocked(api.createFeedback).mock.calls[0][0];
  expect(input).not.toHaveProperty('reporterEmail'); expect(input).not.toHaveProperty('status');
});
it('supports no file and compensates for a failed create', async () => {
  const api = makeApi(); await submitFeedback(api, choices, draft, null); expect(api.uploadAttachment).not.toHaveBeenCalled();
  vi.mocked(api.createFeedback).mockRejectedValue(Error('failed'));
  await expect(submitFeedback(api, choices, draft, new File(['x'], 'x.png', { type: 'image/png' }))).rejects.toThrow('failed');
  expect(api.removeAttachment).toHaveBeenCalledWith('feedback-media/test/file');
  vi.mocked(api.removeAttachment).mockRejectedValue(Error('denied'));
  await expect(submitFeedback(api, choices, draft, new File(['x'], 'x.png', { type: 'image/png' }))).rejects.toThrow('could not be removed');
});
