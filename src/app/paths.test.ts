import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it('keeps standalone admin routes unchanged', async () => {
  vi.stubEnv('VITE_HARVEST_AUTH_MODE', '');
  const { appPaths } = await import('./paths');
  expect(appPaths.adminReviews).toBe('/admin/reviews');
  expect(appPaths.organization).toBe('/account/organization');
});

it('keeps every hosted screen under the HARVEST feedback path', async () => {
  vi.stubEnv('VITE_HARVEST_AUTH_MODE', 'shared');
  const { appPaths } = await import('./paths');
  expect(Object.values(appPaths).every(path => path.startsWith('/feedback/'))).toBe(true);
  expect(appPaths.adminReviews).toBe('/feedback/admin/reviews');
  expect(appPaths.newFeedback).toBe('/feedback/new');
});
