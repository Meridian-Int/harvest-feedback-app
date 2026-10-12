import { expect, it, vi } from 'vitest';
import { getSentryIssues } from './insights';
import { sharedRequest } from './shared-feedback-api';

vi.mock('./amplify', () => ({ requireAmplify: vi.fn(), isHarvestSharedSessionMode: () => true }));
vi.mock('./auth', () => ({ requireUser: () => ({ id: 'operator-1' }), isAdmin: () => true }));
vi.mock('./shared-feedback-api', () => ({ sharedRequest: vi.fn() }));
vi.mock('aws-amplify/data', () => ({ generateClient: () => ({ queries: {} }) }));

it('reads Sentry issues with the shared HARVEST session', async () => {
  vi.mocked(sharedRequest).mockResolvedValueOnce({ sentryIssues: { configured: false, issues: [] } });
  await expect(getSentryIssues()).resolves.toEqual({ configured: false, issues: [] });
  expect(sharedRequest).toHaveBeenCalledWith(expect.stringContaining('sentryIssues'), {});
});
