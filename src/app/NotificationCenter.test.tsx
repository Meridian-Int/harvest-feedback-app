import { act, fireEvent, screen, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import { makeAdminUser, makeClientUser, makeFeedback } from '../test/factories';
import { renderWithProviders } from '../test/render';
import { observeAllFeedback, subscribeMyFeedback } from '../lib/feedback';
import { markNotificationsRead, subscribeNotificationReads } from '../lib/notifications';
import { NotificationCenter } from './NotificationCenter';

function CurrentRoute() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}{location.search}</div>;
}

vi.mock('../lib/feedback', () => ({ observeAllFeedback: vi.fn(() => () => {}), subscribeMyFeedback: vi.fn(() => () => {}) }));
vi.mock('../lib/notifications', () => ({ subscribeNotificationReads: vi.fn(() => () => {}), markNotificationsRead: vi.fn().mockResolvedValue(undefined) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(observeAllFeedback).mockReturnValue(() => {});
  vi.mocked(subscribeMyFeedback).mockReturnValue(() => {});
  vi.mocked(subscribeNotificationReads).mockReturnValue(() => {});
  vi.mocked(markNotificationsRead).mockResolvedValue(undefined);
});

it('shows an admin unread feedback, then marks it read when the bell opens', async () => {
  const admin = makeAdminUser();
  const { user } = renderWithProviders(<NotificationCenter user={admin} />, { user: admin });
  act(() => {
    vi.mocked(observeAllFeedback).mock.calls[0][0]([makeFeedback({ id: 'new-1234', company: 'Acme' })]);
    vi.mocked(subscribeNotificationReads).mock.calls[0][0](new Set());
  });
  expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
  expect(screen.getByRole('dialog', { name: 'Notifications' })).toHaveTextContent('New feedback');
  expect(markNotificationsRead).toHaveBeenCalledWith(['created:new-1234']);
  expect(screen.getByRole('button', { name: 'Notifications, 0 unread' })).toBeInTheDocument();
});

it('announces a fresh update request and closes the top-left toast after five seconds', () => {
  const admin = makeAdminUser();
  renderWithProviders(<NotificationCenter user={admin} />, { user: admin });
  const report = makeFeedback({ id: 'report-1' });
  act(() => {
    vi.mocked(observeAllFeedback).mock.calls[0][0]([report]);
    vi.mocked(subscribeNotificationReads).mock.calls[0][0](new Set(['created:report-1']));
  });
  vi.useFakeTimers();
  act(() => vi.mocked(observeAllFeedback).mock.calls[0][0]([{ ...report, updateRequestedAt: '2026-10-10T10:00:00Z' }]));
  expect(screen.getByRole('status')).toHaveTextContent('Update requested');
  expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
});

it('notifies a client when an admin changes their report and opens the ticket', async () => {
  const client = makeClientUser();
  const { user } = renderWithProviders(<><NotificationCenter user={client} /><CurrentRoute /></>, { user: client, route: '/feedback/new' });
  const report = makeFeedback({ id: 'report-1' });
  act(() => {
    vi.mocked(subscribeMyFeedback).mock.calls[0][0]([report]);
    vi.mocked(subscribeNotificationReads).mock.calls[0][0](new Set(['created:report-1']));
  });
  act(() => vi.mocked(subscribeMyFeedback).mock.calls[0][0]([{ ...report, status: 'IN_PROGRESS', adminActivityAt: '2026-10-10T11:00:00Z' }]));
  expect(screen.getByRole('status')).toHaveTextContent('Your report was updated');
  expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
  expect(markNotificationsRead).toHaveBeenCalledWith(['updated:report-1:2026-10-10T11:00:00Z']);
  await user.click(within(screen.getByRole('dialog', { name: 'Notifications' })).getByRole('button', { name: /Your report was updated/ }));
  expect(screen.getByTestId('current-route')).toHaveTextContent('/feedback/mine?report=report-1');
});

it('ignores historical reports and shows only the latest live client notice', async () => {
  const client = makeClientUser();
  const { user } = renderWithProviders(<NotificationCenter user={client} />, { user: client });
  const old = makeFeedback({ id: 'old' });
  act(() => {
    vi.mocked(subscribeMyFeedback).mock.calls[0][0]([old]);
    vi.mocked(subscribeNotificationReads).mock.calls[0][0](new Set());
  });
  await user.click(screen.getByRole('button', { name: 'Notifications, 0 unread' }));
  const panel = screen.getByRole('dialog', { name: 'Notifications' });
  expect(panel).toHaveTextContent('No new notifications.');
  const report = makeFeedback({ id: 'new', createdAt: '2026-10-10T12:00:00Z' });
  act(() => vi.mocked(subscribeMyFeedback).mock.calls[0][0]([old, report]));
  expect(within(panel).getAllByRole('button')).toHaveLength(1);
  expect(panel).toHaveTextContent('You’ve submitted your report.');
  expect(parseFloat(panel.style.maxHeight)).toBeLessThanOrEqual(320);
  act(() => vi.mocked(subscribeMyFeedback).mock.calls[0][0]([old, { ...report, status: 'CLOSED', adminActivityAt: '2026-10-10T13:00:00Z' }]));
  expect(within(panel).getAllByRole('button')).toHaveLength(1);
  expect(panel).toHaveTextContent('Your report was updated');
  expect(panel).not.toHaveTextContent('You’ve submitted your report.');
});
