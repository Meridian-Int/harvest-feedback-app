import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { makeAdminUser, makeFeedback, makeSentryIssue } from '../../test/factories';
import { renderWithProviders } from '../../test/render';
import { InsightsPage } from './InsightsPage';

const api = vi.hoisted(() => ({ getSentryIssues: vi.fn(), getTrafficInsights: vi.fn(), listAllFeedback: vi.fn(), createFeedback: vi.fn() }));
vi.mock('../../lib/insights', () => ({ getSentryIssues: api.getSentryIssues, getTrafficInsights: api.getTrafficInsights }));
vi.mock('../../lib/feedback', () => ({ listAllFeedback: api.listAllFeedback, createFeedback: api.createFeedback }));

const first = makeSentryIssue();
const second = makeSentryIssue({ id: 'issue-2', title: 'Lambda timeout', project: 'harvest-api', level: 'warning', count: 20, userCount: 5 });
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }

beforeEach(() => {
  vi.clearAllMocks();
  api.getSentryIssues.mockResolvedValue({ configured: true, issues: [first, second] });
  api.getTrafficInsights.mockResolvedValue({ configured: false, users: 0, sessions: 0, pageViews: 0, days: [], pages: [] });
  api.listAllFeedback.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

it('shows live issues and recalculates metrics for the chosen project', async () => {
  const { user } = renderWithProviders(<InsightsPage />, { route: '/admin/insights', user: makeAdminUser() });
  expect(await screen.findByText(first.title)).toBeInTheDocument();
  expect(screen.getByText(second.title)).toBeInTheDocument();
  expect(screen.getByText('196')).toBeInTheDocument();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Project' }), 'harvest-api');
  expect(screen.queryByText(first.title)).not.toBeInTheDocument();
  expect(screen.getByText(second.title)).toBeInTheDocument();
  expect(screen.getByText('20')).toBeInTheDocument();
  expect(screen.getAllByText('1')).toHaveLength(2);
});

it('offers the actual Sentry project slug returned by HARVEST', async () => {
  api.getSentryIssues.mockResolvedValue({ configured: true, issues: [makeSentryIssue({ project: 'javascript-react' })] });
  renderWithProviders(<InsightsPage />, { route: '/admin/insights', user: makeAdminUser() });
  expect(await screen.findByRole('option', { name: 'javascript-react' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'feedback-app' })).not.toBeInTheDocument();
});

it('shows labelled prototype issues without writing to AWS when Sentry is not configured', async () => {
  api.getSentryIssues.mockResolvedValue({ configured: false, issues: [] });
  const { user } = renderWithProviders(<InsightsPage />, { route: '/admin/insights?tab=errors', user: makeAdminUser() });
  expect(await screen.findByText("Cannot read properties of undefined (reading 'amountMinor')")).toBeInTheDocument();
  expect(screen.getByText('356')).toBeInTheDocument();
  expect(screen.getByText(/sample data/)).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Make a report' })).toHaveLength(4);
  expect(screen.getAllByRole('button', { name: 'Make a report' }).every(button => button.hasAttribute('disabled'))).toBe(true);
  expect(api.listAllFeedback).not.toHaveBeenCalled();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Project' }), 'harvest-api');
  expect(screen.getByText('Lambda timed out after 29 seconds')).toBeInTheDocument();
  expect(screen.queryByText("Cannot read properties of undefined (reading 'amountMinor')")).not.toBeInTheDocument();
  expect(screen.getByText('97')).toBeInTheDocument();
  expect(api.createFeedback).not.toHaveBeenCalled();
});

it('creates a report linked to a Sentry issue and opens it', async () => {
  api.createFeedback.mockResolvedValue(makeFeedback({ id: 'new-report', sentryIssueId: first.id }));
  const { user } = renderWithProviders(<><InsightsPage /><LocationProbe /></>, { route: '/admin/insights', user: makeAdminUser() });
  const row = (await screen.findByText(first.title)).closest('article')!;
  await user.click(within(row).getByRole('button', { name: 'Make a report' }));
  await waitFor(() => expect(api.createFeedback).toHaveBeenCalledWith(expect.objectContaining({ sentryIssueId: first.id, priority: 'BUG', severity: 'CRITICAL' })));
  expect(await screen.findByTestId('location')).toHaveTextContent('/admin/reviews?report=new-report');
});

it('opens an already linked report without creating another', async () => {
  api.listAllFeedback.mockResolvedValue([makeFeedback({ id: 'existing-report', sentryIssueId: first.id })]);
  const { user } = renderWithProviders(<><InsightsPage /><LocationProbe /></>, { route: '/admin/insights', user: makeAdminUser() });
  const row = (await screen.findByText(first.title)).closest('article')!;
  await user.click(within(row).getByRole('button', { name: 'View report' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/admin/reviews?report=existing-report');
  expect(api.createFeedback).not.toHaveBeenCalled();
});

it('keeps the Looker iframe and shows prototype traffic when GA4 is unconfigured', async () => {
  const { unmount } = renderWithProviders(<InsightsPage lookerUrl="https://lookerstudio.google.com/embed/reporting/123" />, { route: '/admin/insights?tab=traffic', user: makeAdminUser() });
  expect(screen.getByTitle('HARVEST traffic report')).toHaveAttribute('src', 'https://lookerstudio.google.com/embed/reporting/123');
  expect(api.getSentryIssues).not.toHaveBeenCalled();
  unmount();
  renderWithProviders(<InsightsPage lookerUrl="" />, { route: '/admin/insights?tab=traffic', user: makeAdminUser() });
  expect(screen.queryByTitle('HARVEST traffic report')).not.toBeInTheDocument();
  expect(await screen.findByText('287')).toBeInTheDocument();
  expect(screen.getByText('364')).toBeInTheDocument();
  expect(screen.getByText('Users over time')).toBeInTheDocument();
  expect(screen.getByText('Top pages')).toBeInTheDocument();
  expect(screen.getByText(/Sample values; no live accounts connected/)).toBeInTheDocument();
  expect(api.getSentryIssues).not.toHaveBeenCalled();
});

it('shows live HARVEST GA4 totals and pages without a sample label', async () => {
  api.getTrafficInsights.mockResolvedValue({ configured: true, users: 42, sessions: 60, pageViews: 120, days: [{ day: '20261014', users: 12 }], pages: [{ name: '/data-room', views: 34 }] });
  renderWithProviders(<InsightsPage lookerUrl="" />, { route: '/admin/insights?tab=traffic', user: makeAdminUser() });
  expect(await screen.findByText('42')).toBeInTheDocument();
  expect(screen.getByText('120')).toBeInTheDocument();
  expect(screen.getByText('/data-room')).toBeInTheDocument();
  expect(screen.queryByText(/sample data/)).not.toBeInTheDocument();
  expect(screen.getByText(/HARVEST prestaging Google Analytics/)).toBeInTheDocument();
});
