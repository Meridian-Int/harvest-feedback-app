import { beforeEach, expect, it, vi } from 'vitest';
import { fetchHarvestViewer } from './harvest-viewer';
import { isAdmin } from './auth';
import { getUsableHarvestTokens, HARVEST_SESSION_KEY, readHarvestTokens, restoreSharedHarvestSession } from './harvest-shared-session';

vi.mock('./harvest-viewer', () => ({ fetchHarvestViewer: vi.fn() }));

const viewer = {
  person: { id: 'person-1', email: 'sahil@example.com', name: 'Sahil' },
  memberships: [
    { orgId: 'company-1', orgKind: 'company', orgName: 'Company One', role: 'user' },
    { orgId: 'partner-2', orgKind: 'partner', orgName: 'Partner Two', role: 'user' },
  ],
};

function storage(payload?: unknown) {
  const entries = new Map<string, string>();
  if (payload) entries.set(HARVEST_SESSION_KEY, JSON.stringify(payload));
  return {
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { entries.set(key, value); }),
  };
}

function token(groups: string[] = []) {
  return `header.${btoa(JSON.stringify({ sub: 'sub-1', 'cognito:groups': groups }))}.signature`;
}

beforeEach(() => {
  vi.mocked(fetchHarvestViewer).mockClear();
  vi.mocked(fetchHarvestViewer).mockResolvedValue(viewer as never);
});

it('reads the HARVEST session without changing its stored tokens', () => {
  const values = storage({ accessToken: 'access', idToken: token(), refreshToken: 'secret', expiresAt: Date.now() + 60_000 });
  expect(readHarvestTokens(values)).toMatchObject({ accessToken: 'access', idToken: token() });
  expect(values.setItem).not.toHaveBeenCalled();
});

it('routes a selected partner workspace and remembers it for a later reload', async () => {
  const values = storage({ accessToken: 'access', idToken: token(), refreshToken: 'refresh', expiresAt: Date.now() + 60_000 });
  const user = await restoreSharedHarvestSession(values, 'partner-2');
  expect(fetchHarvestViewer).toHaveBeenCalledWith('access');
  expect(user).toMatchObject({ persona: 'Partner', company: 'Partner Two', harvest: { selectedOrganizationId: 'partner-2' } });
  expect(values.setItem).toHaveBeenCalledWith('harvest:organization:person-1', 'partner-2');
  expect((await restoreSharedHarvestSession(values, null))?.harvest?.selectedOrganizationId).toBe('partner-2');
});

it('does not accept a workspace missing from live HARVEST memberships', async () => {
  const values = storage({ accessToken: 'access', idToken: token(), refreshToken: 'refresh', expiresAt: Date.now() + 60_000 });
  const user = await restoreSharedHarvestSession(values, 'removed-org');
  expect(user?.harvest?.organizationRequired).toBe(true);
  expect(values.setItem).not.toHaveBeenCalled();
});

it('routes a server-verified Operations user to Feedback admin', async () => {
  vi.mocked(fetchHarvestViewer).mockResolvedValue({ ...viewer, feedbackAdmin: true, memberships: [{ orgId: 'operator-1', orgKind: 'operator', orgName: 'Meridian', role: 'user' }] } as never);
  const values = storage({ accessToken: 'access', idToken: token(), refreshToken: 'refresh', expiresAt: Date.now() + 60_000 });
  const user = await restoreSharedHarvestSession(values, 'operator-1');
  expect(user).toMatchObject({ persona: 'Operator', groups: ['feedback-admins'] });
  expect(isAdmin(user)).toBe(true);
  vi.mocked(fetchHarvestViewer).mockResolvedValue({ ...viewer, memberships: [{ orgId: 'operator-1', orgKind: 'operator', orgName: 'Meridian', role: 'user' }] } as never);
  const unassigned = storage({ accessToken: 'access', idToken: token(), refreshToken: 'refresh', expiresAt: Date.now() + 60_000 });
  expect(isAdmin(await restoreSharedHarvestSession(unassigned, 'operator-1'))).toBe(false);
});

it('keeps a multi-membership Operations user on the admin side even when Company is selected', async () => {
  vi.mocked(fetchHarvestViewer).mockResolvedValue({ ...viewer, feedbackAdmin: true, memberships: [
    { orgId: 'operator-1', orgKind: 'operator', orgName: 'Meridian', role: 'user' },
    { orgId: 'company-1', orgKind: 'company', orgName: 'Company One', role: 'owner' },
  ] } as never);
  const values = storage({ accessToken: 'access', idToken: token(), refreshToken: 'refresh', expiresAt: Date.now() + 60_000 });
  const user = await restoreSharedHarvestSession(values, 'company-1');
  expect(isAdmin(user)).toBe(true);
});

it('keeps Company users with Meridian email addresses on the client side', async () => {
  vi.mocked(fetchHarvestViewer).mockResolvedValue({ ...viewer, person: { ...viewer.person, email: 'manasa+clienta@withmeridian.ai' }, memberships: [
    { orgId: 'company-1', orgKind: 'company', orgName: 'Company One', role: 'owner' },
  ] } as never);
  const values = storage({ accessToken: 'access', idToken: token(['feedback-admins']), refreshToken: 'refresh', expiresAt: Date.now() + 60_000 });
  expect(isAdmin(await restoreSharedHarvestSession(values, 'company-1'))).toBe(false);
});

it('does not launch a second login for a missing or expired HARVEST session', async () => {
  expect(await restoreSharedHarvestSession(storage(), null)).toBeNull();
  const expired = storage({ accessToken: 'access', idToken: token(), refreshToken: 'refresh', expiresAt: Date.now() - 1000 });
  await expect(restoreSharedHarvestSession(expired, null)).rejects.toThrow('needs refreshing');
  expect(fetchHarvestViewer).not.toHaveBeenCalled();
});

it('rejects malformed stored sessions and identity tokens', async () => {
  expect(readHarvestTokens(storage({ accessToken: 'access' }))).toBeNull();
  const values = storage({ accessToken: 'access', idToken: 'invalid', refreshToken: 'refresh', expiresAt: Date.now() + 60_000 });
  await expect(restoreSharedHarvestSession(values, null)).rejects.toThrow('could not be read');
});

it('renews an expiring HARVEST session and shares the new tokens with its other tabs', async () => {
  const values = storage({ accessToken: 'old-access', idToken: token(), refreshToken: 'refresh', expiresAt: Date.now() + 1000 });
  const refresh = vi.fn().mockResolvedValue({ accessToken: 'new-access', idToken: token(), expiresAt: Date.now() + 60_000 });
  const renewed = await getUsableHarvestTokens(values, refresh);
  expect(refresh).toHaveBeenCalledWith('refresh');
  expect(renewed.accessToken).toBe('new-access');
  expect(readHarvestTokens(values)?.accessToken).toBe('new-access');
});

it('does not overwrite a different HARVEST account that signed in during refresh', async () => {
  const values = storage({ accessToken: 'old-access', idToken: token(), refreshToken: 'old-refresh', expiresAt: Date.now() + 1000 });
  const refresh = vi.fn().mockImplementation(async () => {
    values.setItem(HARVEST_SESSION_KEY, JSON.stringify({ accessToken: 'other', idToken: token(), refreshToken: 'other-refresh', expiresAt: Date.now() + 60_000 }));
    return { accessToken: 'new-access', idToken: token(), expiresAt: Date.now() + 60_000 };
  });
  await expect(getUsableHarvestTokens(values, refresh)).rejects.toThrow('session changed');
  expect(readHarvestTokens(values)?.accessToken).toBe('other');
});
