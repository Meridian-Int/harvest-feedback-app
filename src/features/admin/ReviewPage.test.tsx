import { beforeEach, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { makeAdminUser, makeFeedback } from '../../test/factories';
import { renderWithProviders } from '../../test/render';
import { ReviewPage } from './ReviewPage';

const api = vi.hoisted(() => ({ listAllFeedback: vi.fn(), observeAllFeedback: vi.fn(), adminUpdate: vi.fn(), getAttachmentUrl: vi.fn() }));
vi.mock('../../lib/feedback', () => api);

const reports = [
  makeFeedback({ id: 'report-a001', title: 'Payment failed', productArea: 'Payment — failed or missing payout', priority: 'BLOCKER', severity: 'CRITICAL', persona: 'Company', company: 'Acme', assignee: 'admin@example.com', createdAt: '2026-10-01T00:00:00Z' }),
  makeFeedback({ id: 'report-b002', title: 'Upload stalled', productArea: 'Data room', priority: 'BUG', severity: 'MEDIUM', persona: 'Partner', company: 'Beta', createdAt: '2026-10-08T00:00:00Z' }),
  makeFeedback({ id: 'report-c003', title: 'Better search', priority: 'IMPROVEMENT', severity: 'LOW', status: 'CLOSED', createdAt: '2026-10-09T00:00:00Z' }),
];

beforeEach(() => {
  vi.clearAllMocks();
  api.listAllFeedback.mockResolvedValue(reports);
  api.observeAllFeedback.mockReturnValue(() => {});
  api.getAttachmentUrl.mockResolvedValue('https://example.com/file.png');
});

it('shows a report delivered by the live subscription', async () => {
  const stop = vi.fn();
  api.observeAllFeedback.mockReturnValue(stop);
  const { unmount } = renderWithProviders(<ReviewPage />, { route: '/admin/reviews', user: makeAdminUser() });
  await screen.findByRole('button', { name: 'View description: Upload stalled' });
  const next = api.observeAllFeedback.mock.calls[0][0] as (rows: typeof reports) => void;
  act(() => next([...reports, makeFeedback({ id: 'live-1', title: 'New live report' })]));
  expect(await screen.findByRole('button', { name: 'View description: New live report' })).toBeInTheDocument();
  unmount();
  expect(stop).toHaveBeenCalledOnce();
});

it('loads reports, counts all open items and filters by area and the metric buttons', async () => {
  const { user } = renderWithProviders(<ReviewPage />, { route: '/admin/reviews', user: makeAdminUser() });
  expect(await screen.findByRole('button', { name: 'View description: Upload stalled' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Open2Across every product area$/ })).toBeInTheDocument();
  expect(within(screen.getByRole('combobox', { name: 'Filter persona' })).getAllByRole('option').map(option => option.textContent)).toEqual(['All personas', 'Company', 'Partner']);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Filter product area' }), 'Data room');
  expect(screen.getByRole('button', { name: 'View description: Upload stalled' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'View description: Payment failed' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^Blockers1Work cannot continue$/ }));
  expect(screen.getByText('No reports match these filters.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByRole('button', { name: 'View description: Payment failed' })).toBeInTheDocument();
});

it('shows the same four-step progress track in admin report rows', async () => {
  api.listAllFeedback.mockResolvedValue([makeFeedback({ id: 'progress-report', title: 'Progress report', status: 'IN_PROGRESS' })]);
  renderWithProviders(<ReviewPage />, { route: '/admin/reviews', user: makeAdminUser() });
  const row = await screen.findByRole('button', { name: 'View description: Progress report' });
  const steps = row.querySelectorAll('.admin-progress-step');
  expect(steps).toHaveLength(4);
  expect(steps[0]).toHaveClass('completed');
  expect(steps[1]).toHaveClass('completed');
  expect(steps[2]).toHaveClass('current');
  expect(steps[3]).toHaveClass('future');
});

it('keeps six per page, resets page when filtering and remembers grid layout', async () => {
  api.listAllFeedback.mockResolvedValue(Array.from({ length: 7 }, (_, index) => makeFeedback({ id: `report-${index}`, title: `Report ${index}`, createdAt: `2026-10-0${index + 1}T00:00:00Z` })));
  const { user } = renderWithProviders(<ReviewPage />, { route: '/admin/reviews?page=2', user: makeAdminUser() });
  expect(await screen.findByRole('button', { name: 'View description: Report 0' })).toBeInTheDocument();
  expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  const layoutToggle = screen.getByRole('group', { name: 'Admin report layout' });
  expect(within(layoutToggle).getByRole('button', { name: 'List' }).querySelector('svg')).toBeInTheDocument();
  expect(within(layoutToggle).getByRole('button', { name: 'Grid' }).querySelector('svg')).toBeInTheDocument();
  expect(screen.queryByText('7 reports')).not.toBeInTheDocument();
  await user.type(screen.getByRole('searchbox', { name: 'Search reports' }), 'Report 6');
  expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'View description: Report 6' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Grid' }));
  expect(localStorage.getItem('harvest-admin-view')).toBe('grid');
});

it('opens the report from its URL, saves status and owner, and shows a toast', async () => {
  api.adminUpdate.mockResolvedValue({ ...reports[0], status: 'ASSIGNED', assignee: 'admin@example.com', adminActivityAt: '2026-10-09T12:00:00Z' });
  const { user } = renderWithProviders(<ReviewPage />, { route: '/admin/reviews?report=report-a001', user: makeAdminUser() });
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Payment failed')).toBeInTheDocument();
  expect(within(dialog).getByText('No attachments on this report.')).toBeInTheDocument();
  await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Report status' }), 'ASSIGNED');
  await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Report owner' }), 'admin@example.com');
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));
  expect(api.adminUpdate).toHaveBeenCalledWith('report-a001', { status: 'ASSIGNED', assignee: 'admin@example.com' });
  expect(await screen.findByRole('status')).toHaveTextContent('Report updated.');
});

it('previews an image, offers a download and shows unavailable media on failure', async () => {
  api.listAllFeedback.mockResolvedValue([{ ...reports[0], attachmentKey: 'feedback-media/identity/file.png', attachmentName: 'proof.png', attachmentType: 'image/png' }]);
  const { user } = renderWithProviders(<ReviewPage />, { route: '/admin/reviews', user: makeAdminUser() });
  await user.click(await screen.findByRole('button', { name: 'View description: Payment failed' }));
  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByRole('img', { name: 'Attached screenshot' })).toHaveAttribute('src', 'https://example.com/file.png');
  expect(within(dialog).getByRole('link', { name: 'Download attachment' })).toHaveAttribute('download', 'proof.png');
  api.getAttachmentUrl.mockRejectedValue(new Error('Missing'));
  await user.click(within(dialog).getByRole('button', { name: 'Close report' }));
  await user.click(screen.getByRole('button', { name: 'View description: Payment failed' }));
  await waitFor(() => expect(within(screen.getByRole('dialog')).getByText('Attachment is unavailable.')).toBeInTheDocument());
});
