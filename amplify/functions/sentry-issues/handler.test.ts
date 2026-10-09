import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { handler } from './handler';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'issue-1', title: 'Payout failed', culprit: 'pay()',
  project: { slug: 'harvest-api' }, level: 'error', count: '12', userCount: 3,
  lastSeen: '2026-10-09T12:00:00Z', permalink: 'https://sentry.io/issues/issue-1/',
  stats: { '24h': [[1, 2], [2, 5]] }, ...overrides,
});

beforeEach(() => {
  vi.stubEnv('SENTRY_AUTH_TOKEN', 'test-token');
  vi.stubEnv('SENTRY_ORG', 'meridian');
  vi.stubEnv('SENTRY_PROJECTS', 'harvest-ui,harvest-api,feedback-app');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('returns setup state without requesting Sentry when the token is missing', async () => {
  vi.stubEnv('SENTRY_AUTH_TOKEN', '');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(handler()).resolves.toEqual({ configured: false, issues: [] });
  expect(fetch).not.toHaveBeenCalled();
});

it('fetches the three unresolved project lists and maps issue metrics', async () => {
  const fetch = vi.fn(async (url: URL, _options: { headers: { Authorization: string } }) => ({
    ok: true,
    json: async () => [row({ project: { slug: url.pathname.split('/')[5] } })],
  }));
  vi.stubGlobal('fetch', fetch);
  const result = await handler();
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls.map(([url]) => url.pathname)).toEqual([
    '/api/0/projects/meridian/harvest-ui/issues/',
    '/api/0/projects/meridian/harvest-api/issues/',
    '/api/0/projects/meridian/feedback-app/issues/',
  ]);
  for (const [url, options] of fetch.mock.calls) {
    expect(url.searchParams.get('query')).toBe('is:unresolved');
    expect(url.searchParams.get('statsPeriod')).toBe('24h');
    expect(options.headers.Authorization).toBe('Bearer test-token');
  }
  expect(result.configured).toBe(true);
  expect(result.issues[0]).toMatchObject({
    id: 'issue-1', title: 'Payout failed', count: 12, userCount: 3, trend: [2, 5],
  });
  expect(result.issues).toHaveLength(3);
});

it('deduplicates configured projects and sorts newest issues first', async () => {
  vi.stubEnv('SENTRY_PROJECTS', 'harvest-ui, harvest-ui');
  const fetch = vi.fn(async () => ({
    ok: true, json: async () => [row({ id: 'old', lastSeen: '2026-10-01T00:00:00Z' }), row({ id: 'new' })],
  }));
  vi.stubGlobal('fetch', fetch);
  const result = await handler();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(result.issues.map(issue => issue.id)).toEqual(['new', 'old']);
});

it('surfaces a failed Sentry request instead of reporting empty results', async () => {
  vi.stubEnv('SENTRY_PROJECTS', 'harvest-ui');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })));
  await expect(handler()).rejects.toThrow('Sentry issues request failed (403)');
});
