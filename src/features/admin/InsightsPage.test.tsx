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

it('keeps the live Looker iframe and shows prototype traffic when it is unconfigured', async () => {
  vi.stubEnv('VITE_LOOKER_EMBED_URL', 'https://lookerstudio.google.com/embed/reporting/123');
  const { unmount } = renderWithProviders(<InsightsPage />, { route: '/admin/insights?tab=traffic', user: makeAdminUser() });
  expect(screen.getByTitle('HARVEST traffic report')).toHaveAttribute('src', 'https://lookerstudio.google.com/embed/reporting/123');
  expect(api.getSentryIssues).not.toHaveBeenCalled();
  unmount();
  vi.stubEnv('VITE_LOOKER_EMBED_URL', '');
  renderWithProviders(<InsightsPage />, { route: '/admin/insights?tab=traffic', user: makeAdminUser() });
  expect(screen.queryByTitle('HARVEST traffic report')).not.toBeInTheDocument();
  expect(screen.getByText('287')).toBeInTheDocument();
  expect(screen.getByText('364')).toBeInTheDocument();
  expect(screen.getByText('Users over time')).toBeInTheDocument();
  expect(screen.getByText('Top pages')).toBeInTheDocument();
  expect(screen.getByText(/Sample values; no live accounts connected/)).toBeInTheDocument();
  expect(api.getSentryIssues).not.toHaveBeenCalled();
});
