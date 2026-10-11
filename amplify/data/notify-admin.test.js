import { expect, it } from 'vitest';
import { request, response } from './notify-admin';

it('disables duplicate legacy email delivery after stream migration', () => {
  const report = { id: 'a1234', title: 'Upload stalled', company: 'Acme', persona: 'Partner', description: 'Private details', reporterEmail: 'partner@example.com' };
  const result = request({ stash: { submittedFeedback: report } });
  expect(result.operation).toBe('Invoke');
  expect(result.payload).toEqual({ deliveryHandledByStream: true });
});

it('returns the saved report even when the mail function fails', () => {
  const report = { id: 'a1234' };
  expect(response({ stash: { submittedFeedback: report }, error: { message: 'SES unavailable' } })).toBe(report);
});
