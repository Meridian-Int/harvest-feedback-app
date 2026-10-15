import { vi } from 'vitest';
vi.mock('../lib/auth', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/auth')>(),
  signOut: vi.fn().mockResolvedValue(undefined),
  selectHarvestOrganization: vi.fn(),
}));
vi.mock('../lib/feedback', () => ({ listAllFeedback: vi.fn().mockResolvedValue([]), observeAllFeedback: vi.fn(() => () => {}), listMyFeedback: vi.fn().mockResolvedValue([]), subscribeMyFeedback: vi.fn(() => () => {}), getFeedback: vi.fn().mockResolvedValue(null) }));
vi.mock('../lib/notifications', () => ({ subscribeNotificationReads: vi.fn(() => () => {}), markNotificationsRead: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../lib/insights', () => ({ getSentryIssues: vi.fn().mockResolvedValue({ configured: false, issues: [] }), getTrafficInsights: vi.fn().mockResolvedValue({ configured: false, users: 0, sessions: 0, pageViews: 0, days: [], pages: [] }), getLookerEmbedUrl: vi.fn().mockReturnValue(null) }));
import { screen } from '@testing-library/react';
import { AppRoutes } from './routes';
import { renderWithProviders } from '../test/render';
import { makeAdminUser, makeClientUser } from '../test/factories';
import { selectHarvestOrganization } from '../lib/auth';

it('redirects signed-out protected routes to sign-in', () => { renderWithProviders(<AppRoutes />, { route: '/feedback/mine', user: null }); expect(screen.getByRole('heading', { name: 'Sign in to Harvest' })).toBeInTheDocument(); });
it.each(['/admin/reviews', '/admin/insights?tab=traffic', '/admin/invite', '/admin/unknown'])('redirects a client away from %s', route => {
  renderWithProviders(<AppRoutes />, { route, user: makeClientUser() }); expect(screen.getByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'Review queue' })).not.toBeInTheDocument();
});
it('lands admins on reviews and exposes role navigation', () => { renderWithProviders(<AppRoutes />, { route: '/', user: makeAdminUser() }); expect(screen.getByRole('heading', { level: 1, name: 'Feedback review' })).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'Review queue' })).toHaveAttribute('aria-current', 'page'); expect(screen.getByRole('link', { name: 'Insights' })).toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'Invite partner' })).not.toBeInTheDocument(); });
it('opens client placeholders and signs out through the shell', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/feedback/new', user: makeClientUser() }); await user.click(screen.getByRole('link', { name: 'My reports' })); expect(screen.getByRole('heading', { name: 'My reports' })).toBeInTheDocument(); expect(document.documentElement.dataset.page).toBe('reports'); await user.click(screen.getByRole('button', { name: 'Sign out' })); expect(await screen.findByRole('heading', { name: 'Sign in to Harvest' })).toBeInTheDocument(); expect(document.documentElement.dataset.page).toBeUndefined();
});
it('keeps the insights tab in the query string and respects a traffic link', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/admin/insights?tab=traffic', user: makeAdminUser() }); expect(screen.getByRole('button', { name: 'Traffic' })).toHaveAttribute('aria-pressed', 'true'); await user.click(screen.getByRole('button', { name: 'Errors' })); expect(screen.getByRole('button', { name: 'Errors' })).toHaveAttribute('aria-pressed', 'true');
});
it('redirects the removed invite URL to admin reviews', () => {
  renderWithProviders(<AppRoutes />, { route: '/admin/invite', user: makeAdminUser() });
  expect(screen.getByRole('heading', { level: 1, name: 'Feedback review' })).toBeInTheDocument();
});
it('requires an explicit organization choice before opening a report workspace', async () => {
  const memberships = [
    { orgId: 'one', orgKind: 'company' as const, orgName: 'Company One', role: 'user' as const },
    { orgId: 'two', orgKind: 'partner' as const, orgName: 'Partner Two', role: 'user' as const },
  ];
  const pending = makeClientUser({ harvest: { personId: 'person-1', memberships, organizationRequired: true } });
  vi.mocked(selectHarvestOrganization).mockReturnValue(makeClientUser({
    harvest: { personId: 'person-1', memberships, selectedOrganizationId: 'two', organizationRequired: false },
    persona: 'Partner', company: 'Partner Two',
  }));
  const { user } = renderWithProviders(<AppRoutes />, { route: '/feedback/new', user: pending });
  expect(screen.getByRole('heading', { name: 'Choose an organization' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Partner Two · Partner' }));
  expect(selectHarvestOrganization).toHaveBeenCalledWith('two');
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
});

it.each(['/feedback/new', '/feedback/mine'])('redirects selected admins out of the client workspace at %s', route => {
  renderWithProviders(<AppRoutes />, { route, user: makeAdminUser() });
  expect(screen.getByRole('heading', { level: 1, name: 'Feedback review' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'My reports' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Request update' })).not.toBeInTheDocument();
});
