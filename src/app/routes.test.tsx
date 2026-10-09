import { vi } from 'vitest';
vi.mock('../lib/feedback', () => ({ listMyFeedback: vi.fn().mockResolvedValue([]), subscribeMyFeedback: vi.fn(() => () => {}), getFeedback: vi.fn().mockResolvedValue(null) }));
import { screen } from '@testing-library/react';
import { AppRoutes } from './routes';
import { renderWithProviders } from '../test/render';
import { makeAdminUser, makeClientUser } from '../test/factories';

it('redirects signed-out protected routes to sign-in', () => { renderWithProviders(<AppRoutes />, { route: '/feedback/mine', user: null }); expect(screen.getByRole('heading', { name: 'Sign in to Harvest' })).toBeInTheDocument(); });
it.each(['/admin/reviews', '/admin/insights?tab=traffic', '/admin/unknown'])('redirects a client away from %s', route => {
  renderWithProviders(<AppRoutes />, { route, user: makeClientUser() }); expect(screen.getByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'Review queue' })).not.toBeInTheDocument();
});
it('lands admins on reviews and exposes role navigation', () => { renderWithProviders(<AppRoutes />, { route: '/', user: makeAdminUser() }); expect(screen.getByRole('heading', { level: 1, name: 'Feedback review' })).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'Review queue' })).toHaveAttribute('aria-current', 'page'); expect(screen.getByRole('link', { name: 'Insights' })).toBeInTheDocument(); });
it('opens client placeholders and signs out through the shell', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/feedback/new', user: makeClientUser() }); await user.click(screen.getByRole('link', { name: 'My reports' })); expect(screen.getByRole('heading', { name: 'My reports' })).toBeInTheDocument(); expect(document.documentElement.dataset.page).toBe('reports'); await user.click(screen.getByRole('button', { name: 'Sign out' })); expect(screen.getByRole('heading', { name: 'Sign in to Harvest' })).toBeInTheDocument(); expect(document.documentElement.dataset.page).toBeUndefined();
});
it('keeps the insights tab in the query string and respects a traffic link', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/admin/insights?tab=traffic', user: makeAdminUser() }); expect(screen.getByRole('button', { name: 'Traffic' })).toHaveAttribute('aria-pressed', 'true'); await user.click(screen.getByRole('button', { name: 'Errors' })); expect(screen.getByRole('button', { name: 'Errors' })).toHaveAttribute('aria-pressed', 'true');
});
