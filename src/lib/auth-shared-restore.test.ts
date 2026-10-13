import { beforeEach, expect, it, vi } from 'vitest';
const shared = vi.hoisted(() => ({ restore: vi.fn() }));
vi.mock('./harvest-shared-session', () => ({ restoreSharedHarvestSession: shared.restore }));
vi.mock('./amplify', () => ({ isAmplifyConfigured: () => true, isHarvestPasswordMode: () => false, isHarvestSharedSessionMode: () => true, requireAmplify: vi.fn() }));
import { getCurrentUser, requireUser, restoreSession } from './auth';
const user = { id: 'selected-sub', email: 'admin@example.com', name: 'Admin', persona: 'Operator' as const, company: 'Meridian', needsPersonaSetup: false, groups: ['feedback-admins'] };
beforeEach(async () => { shared.restore.mockReset().mockResolvedValue(null); await restoreSession(); });
it('keeps the verified actor available while a focus check is pending', async () => {
  shared.restore.mockResolvedValueOnce(user); await restoreSession();
  let finish!: (value: typeof user | null) => void;
  shared.restore.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = restoreSession();
  expect(requireUser()).toEqual(user);
  finish(null); await pending;
  expect(getCurrentUser()).toBeNull();
});
it('clears the actor when live revalidation rejects access', async () => {
  shared.restore.mockResolvedValueOnce(user); await restoreSession();
  shared.restore.mockRejectedValueOnce(new Error('Revoked'));
  await expect(restoreSession()).rejects.toThrow('Revoked');
  expect(() => requireUser()).toThrow('Sign in');
});
