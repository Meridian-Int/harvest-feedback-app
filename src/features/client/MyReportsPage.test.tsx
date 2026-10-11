import { ReportPills } from './ReportDetailDialog';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ClientRoutes } from './ClientRoutes';
import { MyReportsView as MyReportsPage } from './MyReportsView';
import { choices, controls, makeApi, makeReport } from './testing/support';

it('loads owner-returned data, paginates, preserves page on layout, resets on filter', async () => {
  const api = makeApi();
  vi.mocked(api.listMyFeedback).mockResolvedValue(Array.from({ length: 8 }, (_, index) => makeReport({ id: String(index), title: `Report ${index}`, createdAt: `2026-10-0${index + 1}T00:00:00Z`, status: index === 7 ? 'CLOSED' : 'NEW' })));
  render(<MyReportsPage api={api} controls={controls} reportId={null} onOpenReport={vi.fn()} onCloseReport={vi.fn()} onNewFeedback={vi.fn()} />);
  const user = userEvent.setup(); await screen.findByText('Report 6'); expect(screen.queryByText('Report 7')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Next' })); expect(screen.getByText('Report 7')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Grid' })); expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Status'), 'CLOSED'); expect(screen.getByText('Page 1 of 1')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Request update' })).not.toBeInTheDocument();
});
it('requests once, refreshes pending, and clears after an admin subscription update', async () => {
  const api = makeApi(); const report = makeReport(); vi.mocked(api.listMyFeedback).mockResolvedValue([report]);
  vi.mocked(api.getFeedback).mockResolvedValue({ ...report, updateRequestedAt: '2026-10-09T12:00:00Z' });
  let publish!: (reports: typeof report[]) => void;
  api.subscribeMyFeedback = vi.fn(next => { publish = next; return vi.fn(); });
  render(<MyReportsPage api={api} controls={controls} reportId={null} onOpenReport={vi.fn()} onCloseReport={vi.fn()} onNewFeedback={vi.fn()} />);
  const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: 'Request update' }));
  expect(await screen.findByRole('button', { name: 'Update requested' })).toBeDisabled(); expect(api.requestUpdate).toHaveBeenCalledTimes(1);
  act(() => publish([{ ...report, updateRequestedAt: '2026-10-09T12:00:00Z', adminActivityAt: '2026-10-09T13:00:00Z' }]));
  expect(screen.getByRole('button', { name: 'Request update' })).toBeEnabled();
});
it('dismisses the request update confirmation after four seconds', () => {
  vi.useFakeTimers();
  try {
    const api = makeApi();
    render(<MyReportsPage api={api} controls={controls} reportId={null} onOpenReport={vi.fn()} onCloseReport={vi.fn()} onNewFeedback={vi.fn()} initialMessage="Update requested." />);
    expect(screen.getByText('Update requested.', { selector: '.toast' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('Update requested.')).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
it('shows true empty and retry after load failure', async () => {
  const api = makeApi(); vi.mocked(api.listMyFeedback).mockRejectedValueOnce(Error('failed'));
  render(<MyReportsPage api={api} controls={controls} reportId={null} onOpenReport={vi.fn()} onCloseReport={vi.fn()} onNewFeedback={vi.fn()} />);
  const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: 'Try again' })); expect(await screen.findByText('No reports yet. Submit feedback to see it here.')).toBeInTheDocument();
});
function Navigation() {
  const location = useLocation(), navigate = useNavigate();
  return <><span data-testid="url">{location.pathname}{location.search}</span><button onClick={() => navigate(-1)}>Back</button><button onClick={() => navigate(1)}>Forward</button></>;
}
it('opens by URL, closes to list, supports back/forward, and restores focus', async () => {
  const api = makeApi(); vi.mocked(api.listMyFeedback).mockResolvedValue([makeReport()]);
  render(<MemoryRouter initialEntries={['/feedback/mine']}><Navigation /><Routes><Route path="/feedback/*" element={<ClientRoutes api={api} choices={choices} controls={controls} draftScope="a" />} /></Routes></MemoryRouter>);
  const user = userEvent.setup(); const arrow = await screen.findByRole('button', { name: /View description/ }); await user.click(arrow);
  expect(screen.getByTestId('url')).toHaveTextContent('?report=report-abcd');
  const dialog = await screen.findByRole('dialog'); await within(dialog).findByText('Download fails for signed document');
  await user.click(within(dialog).getByRole('button', { name: 'Done' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(arrow).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Forward' })); expect(await screen.findByRole('dialog')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Back' })); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('handles inaccessible deep links and removes only report parameter on close', async () => {
  const api = makeApi(); vi.mocked(api.getFeedback).mockResolvedValue(null);
  render(<MemoryRouter initialEntries={['/feedback/mine?report=unreadable&keep=1']}><Navigation /><Routes><Route path="/feedback/*" element={<ClientRoutes api={api} choices={choices} controls={controls} draftScope="a" />} /></Routes></MemoryRouter>);
  const user = userEvent.setup(); expect(await screen.findByText('This report is unavailable or you do not have access to it.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Done' })); expect(screen.getByTestId('url')).toHaveTextContent('/feedback/mine?keep=1');
});

it('automatically marks Blocker reports as Critical, including older report data', () => {
  const { rerender } = render(<ReportPills report={makeReport({ priority: 'BLOCKER', severity: 'LOW' })} />);
  expect(screen.getByText('Blocker')).toBeInTheDocument();
  expect(screen.getByText('Critical')).toBeInTheDocument();
  rerender(<ReportPills report={makeReport({ priority: 'BUG' })} />);
  expect(screen.queryByText('Critical')).not.toBeInTheDocument();
});
