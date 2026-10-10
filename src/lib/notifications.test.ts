import { beforeEach, vi } from 'vitest';
import { markNotificationsRead, subscribeNotificationReads } from './notifications';

const data = vi.hoisted(() => ({ subscribe: vi.fn(), unsubscribe: vi.fn(), create: vi.fn(), get: vi.fn() }));
vi.mock('./amplify', () => ({ requireAmplify: vi.fn() }));
vi.mock('./auth', () => ({ requireUser: () => ({ id: 'viewer-1' }) }));
vi.mock('aws-amplify/data', () => ({ generateClient: () => ({ models: { NotificationRead: {
  observeQuery: () => ({ subscribe: data.subscribe }), create: data.create, get: data.get,
} } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  data.subscribe.mockReturnValue({ unsubscribe: data.unsubscribe });
  data.create.mockResolvedValue({ data: { id: 'receipt-1' } });
  data.get.mockResolvedValue({ data: null });
});

it('streams only synced read receipts and cleans up', () => {
  const next = vi.fn();
  const error = vi.fn();
  const stop = subscribeNotificationReads(next, error);
  const observer = data.subscribe.mock.calls[0][0];
  observer.next({ items: [{ eventId: 'created:one' }], isSynced: false });
  expect(next).not.toHaveBeenCalled();
  observer.next({ items: [{ eventId: 'created:one' }], isSynced: true });
  expect(next).toHaveBeenCalledWith(new Set(['created:one']));
  observer.error(new Error('stream failed'));
  expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'stream failed' }));
  stop();
  expect(data.unsubscribe).toHaveBeenCalledOnce();
});

it('stores one deterministic receipt per viewer and event', async () => {
  await markNotificationsRead(['created:one', 'requested:two:now']);
  expect(data.create).toHaveBeenCalledWith({ id: 'viewer-1::created:one', eventId: 'created:one' });
  expect(data.create).toHaveBeenCalledWith({ id: 'viewer-1::requested:two:now', eventId: 'requested:two:now' });
});

it('reports a failed read receipt instead of silently clearing unread state', async () => {
  data.create.mockResolvedValueOnce({ data: null, errors: [{ message: 'Write failed' }] });
  await expect(markNotificationsRead(['created:one'])).rejects.toThrow('Write failed');
});

it('treats a receipt created in another tab as read', async () => {
  data.create.mockResolvedValueOnce({ data: null, errors: [{ message: 'Already exists' }] });
  data.get.mockResolvedValueOnce({ data: { eventId: 'created:one' } });
  await expect(markNotificationsRead(['created:one'])).resolves.toBeUndefined();
});
