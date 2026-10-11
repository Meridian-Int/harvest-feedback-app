import { afterEach, expect, it, vi } from 'vitest';
import { handler } from './handler';

const accessToken = `header.${Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url')}.signature`;
const event = { request: { headers: { authorization: accessToken } }, identity: { sub: 'user-1' } };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('returns only a live HARVEST person and memberships after the API verifies the caller token', async () => {
  vi.stubEnv('HARVEST_API_BASE_URL', 'https://staging-api.example.com');
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    person: { id: 'person-1', email: 'client@example.com', name: 'Client' },
    memberships: [{ orgId: 'org-1', orgKind: 'company', orgName: 'Client Co', role: 'user', permissions: [] }],
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(handler(event)).resolves.toMatchObject({ person: { id: 'person-1' }, memberships: [{ orgKind: 'company' }] });
  expect(fetcher).toHaveBeenCalledWith('https://staging-api.example.com/api/me', expect.objectContaining({
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  }));
});

it('rejects a different user token before sending it to HARVEST', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(handler({ ...event, identity: { sub: 'user-2' } })).rejects.toThrow('Could not verify');
  expect(fetcher).not.toHaveBeenCalled();
});

it('rejects a missing authorization header', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(handler({ identity: { sub: 'user-1' } })).rejects.toThrow('Could not verify');
  expect(fetcher).not.toHaveBeenCalled();
});

it('fails closed when HARVEST rejects the token or returns no active membership', async () => {
  vi.stubEnv('HARVEST_API_BASE_URL', 'https://staging-api.example.com');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ person: { id: 'person-1', email: 'client@example.com', name: null }, memberships: [] }), { status: 200 })));
  await expect(handler(event)).rejects.toThrow('Could not verify');
  await expect(handler(event)).rejects.toThrow('no active organization');
});
