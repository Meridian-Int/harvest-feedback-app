import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { makeAdminUser, makeFeedback, makeSentryIssue } from '../../test/factories';
import { renderWithProviders } from '../../test/render';
import { InsightsPage } from './InsightsPage';

const api = vi.hoisted(() => ({ getSentryIssues: vi.fn(), listAllFeedback: vi.fn(), createFeedback: vi.fn() }));
vi.mock('../../lib/insights', () => ({ getSentryIssues: api.getSentryIssues }));
vi.mock('../../lib/feedback', () => ({ listAllFeedback: api.listAllFeedback, createFeedback: api.createFeedback }));

const first = makeSentryIssue();
const second = makeSentryIssue({ id: 'issue-2', title: 'Lambda timeout', project: 'harvest-api', level: 'warning', count: 20, userCount: 5 });
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }

beforeEach(() => {
  vi.clearAllMocks();
  api.getSentryIssues.mockResolvedValue({ configured: true, issues: [first, second] });
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

it('shows the setup message when Sentry is not configured', async () => {
  api.getSentryIssues.mockResolvedValue({ configured: false, issues: [] });
  renderWithProviders(<InsightsPage />, { route: '/admin/insights?tab=errors', user: makeAdminUser() });
  expect(await screen.findByText('Connect Sentry to see application errors here.')).toBeInTheDocument();
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

it('shows a Looker iframe only when a valid embed URL is configured', async () => {
  vi.stubEnv('VITE_LOOKER_EMBED_URL', 'https://lookerstudio.google.com/embed/reporting/123');
  const { unmount } = renderWithProviders(<InsightsPage />, { route: '/admin/insights?tab=traffic', user: makeAdminUser() });
  expect(screen.getByTitle('HARVEST traffic report')).toHaveAttribute('src', 'https://lookerstudio.google.com/embed/reporting/123');
  expect(api.getSentryIssues).not.toHaveBeenCalled();
  unmount();
  vi.stubEnv('VITE_LOOKER_EMBED_URL', '');
  renderWithProviders(<InsightsPage />, { route: '/admin/insights?tab=traffic', user: makeAdminUser() });
  expect(screen.getByText('Connect a Looker Studio embed URL to see Google Analytics traffic here.')).toBeInTheDocument();
});
