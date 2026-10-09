import { beforeEach, vi } from 'vitest';
import { getSentryIssues } from './insights';
import { makeAdminUser, makeClientUser, makeSentryIssue } from '../test/factories';

const state = vi.hoisted(() => ({ user: null as ReturnType<typeof makeAdminUser> | null }));
const query = vi.hoisted(() => vi.fn());
vi.mock('./amplify', () => ({ requireAmplify: vi.fn() }));
vi.mock('./auth', () => ({ requireUser: () => { if (!state.user) throw new Error('Sign in'); return state.user; }, isAdmin: (user: { groups: string[] }) => user.groups.includes('admins') }));
vi.mock('aws-amplify/data', () => ({ generateClient: () => ({ queries: { sentryIssues: query } }) }));

beforeEach(() => { vi.clearAllMocks(); state.user = makeAdminUser(); });

it('loads and normalizes the admin-only Sentry query', async () => {
  const issue = makeSentryIssue();
  query.mockResolvedValue({ data: { configured: true, issues: [{ ...issue, trend: [1, null, 3] }, null] } });
  await expect(getSentryIssues()).resolves.toEqual({ configured: true, issues: [{ ...issue, trend: [1, 3] }] });
});

it('passes through unconfigured state and reports query errors', async () => {
  query.mockResolvedValueOnce({ data: { configured: false, issues: [] } }).mockResolvedValueOnce({ data: null, errors: [{ message: 'Sentry unavailable' }] });
  await expect(getSentryIssues()).resolves.toEqual({ configured: false, issues: [] });
  await expect(getSentryIssues()).rejects.toThrow('Sentry unavailable');
});

it('rejects a non-admin before calling the query', async () => {
  state.user = makeClientUser();
  await expect(getSentryIssues()).rejects.toThrow('Admin access required.');
  expect(query).not.toHaveBeenCalled();
});
