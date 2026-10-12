import { afterEach, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({ getConfig: vi.fn(), session: vi.fn() }));
vi.mock('aws-amplify', () => ({ Amplify: { getConfig: service.getConfig, configure: vi.fn() } }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: service.session }));
import { fetchHarvestViewer } from './harvest-viewer';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('sends the access token only in the authorization header and parses live memberships', async () => {
  service.getConfig.mockReturnValue({ API: { GraphQL: { endpoint: 'https://feedback.example.com/graphql' } } });
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { harvestViewer: {
    person: { id: 'person-1', email: 'client@example.com', name: 'Client' },
    memberships: [{ orgId: 'company-1', orgKind: 'company', orgName: 'Company', role: 'user' }],
  } } }), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(fetchHarvestViewer('access-token')).resolves.toMatchObject({ person: { id: 'person-1' } });
  const call = fetcher.mock.calls[0];
  expect(call[1].headers.Authorization).toBe('access-token');
  expect(call[1].body).not.toContain('access-token');
});

it('rejects an incomplete GraphQL response', async () => {
  service.getConfig.mockReturnValue({ API: { GraphQL: { endpoint: 'https://feedback.example.com/graphql' } } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { harvestViewer: null } }), { status: 200 })));
  await expect(fetchHarvestViewer('access-token')).rejects.toThrow('Could not verify');
});

it('uses HARVEST local account data only in an explicitly enabled development preview', async () => {
  vi.stubEnv('DEV', true);
  vi.stubEnv('VITE_HARVEST_AUTH_MODE', 'shared');
  vi.stubEnv('VITE_FEEDBACK_LOCAL_PREVIEW', 'true');
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    person: { id: 'person-1', email: 'client@example.com', name: 'Client' },
    memberships: [{ orgId: 'company-1', orgKind: 'company', orgName: 'Company', role: 'user' }],
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(fetchHarvestViewer('access-token')).resolves.toMatchObject({ person: { id: 'person-1' } });
  expect(fetcher).toHaveBeenCalledWith('/api/me', { headers: { Authorization: 'Bearer access-token' }, cache: 'no-store' });
});
