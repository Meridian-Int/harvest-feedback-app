import { beforeEach, expect, it, vi } from 'vitest';
import { markNotificationsRead, subscribeNotificationReads } from './notifications';
import { sharedRequest } from './shared-feedback-api';

vi.mock('./amplify', () => ({ requireAmplify: vi.fn(), isHarvestSharedSessionMode: () => true, isLocalFeedbackPreview: () => false }));
vi.mock('./auth', () => ({ requireUser: () => ({ id: 'viewer-1' }) }));
vi.mock('./shared-feedback-api', () => ({ sharedRequest: vi.fn() }));
vi.mock('aws-amplify/data', () => ({ generateClient: () => ({ models: {} }) }));

beforeEach(() => vi.mocked(sharedRequest).mockReset());

it('loads the signed-in user’s read receipts from every page', async () => {
  vi.mocked(sharedRequest).mockResolvedValueOnce({ listNotificationReads: { items: [{ eventId: 'first' }], nextToken: 'two' } })
    .mockResolvedValueOnce({ listNotificationReads: { items: [{ eventId: 'second' }], nextToken: null } });
  const next = vi.fn();
  const stop = subscribeNotificationReads(next, vi.fn());
  await vi.waitFor(() => expect(next).toHaveBeenCalledWith(new Set(['first', 'second'])));
  stop();
});

it('writes a deterministic read receipt without an Amplify-owned session', async () => {
  vi.mocked(sharedRequest).mockResolvedValue({ createNotificationRead: { id: 'viewer-1::event-1', eventId: 'event-1' } });
  await markNotificationsRead(['event-1']);
  expect(sharedRequest).toHaveBeenCalledWith(expect.stringContaining('createNotificationRead'), {
    input: { id: 'viewer-1::event-1', eventId: 'event-1' },
  });
});
