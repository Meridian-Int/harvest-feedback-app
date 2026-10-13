import { beforeEach, expect, it, vi } from 'vitest';
import { authorize, canRead, updateFields, type Actor, type Event } from './authorization';
const cognito = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class { send = cognito.send },
  GetUserCommand: class { constructor(public input: unknown) {} },
}));
const viewer = { person: { id: 'p', email: 'client@example.com', name: 'Client' }, memberships: [{ orgId: 'org', orgKind: 'company' as const, orgName: 'Company', role: 'user' as const }] };
const actor: Actor = { sub: 'sub', viewer, admin: false };
const report = { owner: 'sub', organizationId: 'org', status: 'NEW' };
const event = (): Event => ({ arguments: {}, info: { fieldName: 'getFeedback' }, identity: { sub: 'sub', issuer: 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_pool', claims: { token_use: 'access', client_id: 'client', 'cognito:groups': ['feedback-admins'] } }, request: { headers: { authorization: 'access' } } });
beforeEach(() => { cognito.send.mockReset().mockResolvedValue({ UserAttributes: [{ Name: 'sub', Value: 'sub' }] }); vi.stubEnv('HARVEST_USER_POOL_ID', 'us-east-2_pool'); vi.stubEnv('HARVEST_APP_CLIENT_ID', 'client'); vi.stubEnv('HARVEST_API_BASE_URL', 'https://staging.example.com'); });
it('requires both server assignment and live Operator membership', async () => {
  const client = () => Promise.resolve(new Response(JSON.stringify(viewer)));
  expect((await authorize(event(), async () => ({ enabled: true }), client)).admin).toBe(false);
  const operator = () => Promise.resolve(new Response(JSON.stringify({ ...viewer, memberships: [{ ...viewer.memberships[0], orgKind: 'operator' }] })));
  expect((await authorize(event(), async () => null, operator)).admin).toBe(false);
  expect((await authorize(event(), async () => ({ enabled: true }), operator)).admin).toBe(true);
  expect((await authorize(event(), async () => ({ enabled: false }), operator)).admin).toBe(false);
});
it('rechecks revocation using the same token', async () => {
  const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(viewer))).mockResolvedValueOnce(new Response(JSON.stringify({ ...viewer, memberships: [] })));
  await authorize(event(), async () => null, request);
  await expect(authorize(event(), async () => null, request)).rejects.toThrow('no active organization');
});
it.each([{ token_use: 'id', client_id: 'client' }, { token_use: 'access', client_id: 'other' }])('denies wrong token use/client', async claims => {
  const candidate = event(); candidate.identity!.claims = claims;
  await expect(authorize(candidate, vi.fn())).rejects.toThrow('Unauthorized');
});
it('fails closed when HARVEST denies the token', async () => {
  await expect(authorize(event(), async () => ({ enabled: true }), async () => new Response('', { status: 401 }))).rejects.toThrow('Unauthorized');
});
it('rejects a Cognito-revoked token before fetching membership', async () => {
  cognito.send.mockRejectedValue(new Error('NotAuthorizedException'));
  const request = vi.fn();
  await expect(authorize(event(), async () => null, request)).rejects.toThrow('Unauthorized');
  expect(request).not.toHaveBeenCalled();
});
it('isolates subjects and revoked organizations', () => {
  expect(canRead(actor, report)).toBe(true);
  expect(canRead(actor, { ...report, owner: 'other' })).toBe(false);
  expect(canRead(actor, { ...report, organizationId: 'removed' })).toBe(false);
});
it.each(['owner', 'status', 'assignee', 'reporterEmail', 'adminActivityAt', 'description'])('denies client field %s', key => {
  expect(() => updateFields(actor, report, { id: 'id', [key]: 'forged' }, 1000)).toThrow('Unauthorized report change');
});
it('generates trusted timestamps and denies closed report requests', () => {
  expect(updateFields(actor, report, { updateRequestedAt: '2999-01-01' }, 1000)).toEqual({ updateRequestedAt: '1970-01-01T00:00:01.000Z' });
  expect(() => updateFields(actor, { ...report, status: 'CLOSED' }, { updateRequestedAt: 'x' }, 1000)).toThrow('Unauthorized report change');
});
it('limits admin edits and clears pending requests with server activity', () => {
  expect(updateFields({ ...actor, admin: true }, { ...report, updateRequestedAt: '1970-01-01T00:00:02Z' }, { status: 'ASSIGNED', assignee: null }, 1000)).toEqual({ status: 'ASSIGNED', assignee: null, adminActivityAt: '1970-01-01T00:00:02.001Z' });
  expect(() => updateFields({ ...actor, admin: true }, report, { status: 'CLOSED', owner: 'other' }, 1000)).toThrow('Unauthorized report change');
});
