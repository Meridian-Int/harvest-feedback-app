import { afterEach, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Link } from 'react-router-dom';
import { makeAdminUser } from '../test/factories';
import { renderWithProviders } from '../test/render';
import { Telemetry } from './App';

const sentry = vi.hoisted(() => ({ setUser: vi.fn() }));
vi.mock('@sentry/react', () => sentry);
afterEach(() => { vi.unstubAllEnvs(); delete (window as Window & { gtag?: unknown }).gtag; vi.clearAllMocks(); });

it('sends path-only GA4 page views on route changes and only the user id to Sentry', async () => {
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST');
  vi.stubEnv('VITE_SENTRY_DSN', 'https://example.invalid/1');
  const gtag = vi.fn();
  (window as Window & { gtag?: typeof gtag }).gtag = gtag;
  const { user } = renderWithProviders(<><Telemetry /><Link to="/admin/insights?tab=traffic">Change tab</Link><Link to="/admin/reviews?report=secret-id">Review</Link></>, { route: '/admin/insights?tab=errors', user: makeAdminUser() });
  expect(sentry.setUser).toHaveBeenCalledWith({ id: 'admin@example.com' });
  expect(gtag).toHaveBeenCalledWith('event', 'page_view', expect.objectContaining({ page_path: '/admin/insights' }));
  await user.click(screen.getByRole('link', { name: 'Change tab' }));
  expect(gtag).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('link', { name: 'Review' }));
  expect(gtag).toHaveBeenCalledTimes(2);
  expect(gtag).toHaveBeenLastCalledWith('event', 'page_view', expect.objectContaining({ page_path: '/admin/reviews' }));
  expect(JSON.stringify(gtag.mock.calls)).not.toContain('secret-id');
});
