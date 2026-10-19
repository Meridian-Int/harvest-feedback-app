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
it.each([
  ['prestaging', 'us-east-2_9T9vblhIf', '1kgpn379o3obvefdfrms9pp6ho', 'https://hjyuhqzj1i.execute-api.us-east-2.amazonaws.com'],
  ['production', 'us-east-2_oadf82ZLn', '2igh4vncukumgslfn9u17ancuo', 'https://5fbi1qzdl5.execute-api.us-east-2.amazonaws.com'],
] as const)('uses live HARVEST %s membership for client and Operations admin access', async (_target, pool, client, api) => {
  vi.stubEnv('HARVEST_USER_POOL_ID', pool); vi.stubEnv('HARVEST_APP_CLIENT_ID', client); vi.stubEnv('HARVEST_API_BASE_URL', api);
  const candidate = event(); candidate.identity!.issuer = `https://cognito-idp.us-east-2.amazonaws.com/${pool}`; candidate.identity!.claims!.client_id = client;
  const request = vi.fn(async (..._args: Parameters<typeof fetch>) => new Response(JSON.stringify(viewer)));
  expect((await authorize(candidate, request)).admin).toBe(false);
  expect(String(request.mock.calls[0][0])).toBe(`${api}/api/me`);
  request.mockImplementation(async () => new Response(JSON.stringify({ ...viewer, memberships: [{ ...viewer.memberships[0], orgKind: 'operator', role: 'user' }] })));
  expect((await authorize(candidate, request)).admin).toBe(true);
});
it.each([
  ['operator', 'owner', true], ['operator', 'admin', true], ['operator', 'user', true],
  ['company', 'owner', false], ['company', 'admin', false],
  ['partner', 'owner', false], ['partner', 'admin', false],
] as const)('derives Feedback admin from live %s %s membership', async (orgKind, role, expected) => {
  const request = () => Promise.resolve(new Response(JSON.stringify({ ...viewer, memberships: [{ ...viewer.memberships[0], orgKind, role }] })));
  expect((await authorize(event(), request)).admin).toBe(expected);
});
it('rechecks removal from Operations using the same token', async () => {
  const operator = { ...viewer.memberships[0], orgKind: 'operator', role: 'user' };
  const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ...viewer, memberships: [operator] })))
    .mockResolvedValueOnce(new Response(JSON.stringify(viewer)));
  expect((await authorize(event(), request)).admin).toBe(true);
  expect((await authorize(event(), request)).admin).toBe(false);
});
it.each(['company', 'partner'] as const)('does not grant admin from a Meridian email with only %s membership', async orgKind => {
  const request = () => Promise.resolve(new Response(JSON.stringify({ ...viewer, person: { ...viewer.person, email: 'manasa+clienta@withmeridian.ai' }, memberships: [{ ...viewer.memberships[0], orgKind }] })));
  expect((await authorize(event(), request)).admin).toBe(false);
});
it('grants admin from an Operations membership even when Company is also present', async () => {
  const request = () => Promise.resolve(new Response(JSON.stringify({ ...viewer, memberships: [
    viewer.memberships[0], { ...viewer.memberships[0], orgId: 'operations', orgKind: 'operator', role: 'user' },
  ] })));
  expect((await authorize(event(), request)).admin).toBe(true);
});
it('rechecks revocation using the same token', async () => {
  const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(viewer))).mockResolvedValueOnce(new Response(JSON.stringify({ ...viewer, memberships: [] })));
  await authorize(event(), request);
  await expect(authorize(event(), request)).rejects.toThrow('no active organization');
});
it.each([{ token_use: 'id', client_id: 'client' }, { token_use: 'access', client_id: 'other' }])('denies wrong token use/client', async claims => {
  const candidate = event(); candidate.identity!.claims = claims;
  await expect(authorize(candidate, vi.fn())).rejects.toThrow('Unauthorized');
});
it('fails closed when HARVEST denies the token', async () => {
  await expect(authorize(event(), async () => new Response('', { status: 401 }))).rejects.toThrow('Unauthorized');
});
it('rejects a Cognito-revoked token before fetching membership', async () => {
  cognito.send.mockRejectedValue(new Error('NotAuthorizedException'));
  const request = vi.fn();
  await expect(authorize(event(), request)).rejects.toThrow('Unauthorized');
  expect(request).not.toHaveBeenCalled();
});
it('isolates subjects and revoked organizations', () => {
  expect(canRead(actor, report)).toBe(true);
  expect(canRead(actor, { ...report, owner: 'other' })).toBe(false);
  expect(canRead(actor, { ...report, organizationId: 'removed' })).toBe(false);
});
it.each(['owner', 'status', 'assignee', 'reporterEmail', 'adminActivityAt', 'updateRespondedAt', 'description', 'linearTeamId', 'linearIssueId', 'linearIssueUrl', 'linearSyncStatus'])('denies client field %s', key => {
  expect(() => updateFields(actor, report, { id: 'id', [key]: 'forged' }, 1000)).toThrow('Unauthorized report change');
});

it('locks a routed team and never accepts client supplied Linear issue fields', () => {
  const admin = { ...actor, admin: true };
  const team = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  expect(updateFields(admin, report, { status: 'ASSIGNED', linearTeamId: team }, 1000, [], [team])).toMatchObject({ linearTeamId: team, linearSyncStatus: 'PENDING' });
  expect(() => updateFields(admin, { ...report, status: 'ASSIGNED', linearTeamId: team, linearSyncStatus: 'PENDING' }, { status: 'ASSIGNED', linearTeamId: 'other' }, 1000, [], ['other'])).toThrow('Linear routing has already started.');
  expect(() => updateFields(admin, report, { status: 'ASSIGNED', linearIssueId: 'forged' }, 1000)).toThrow('Unauthorized report change.');
});
it('requires a Linear team for assignment when the integration is configured', () => {
  const admin = { ...actor, admin: true };
  expect(() => updateFields(admin, report, { status: 'ASSIGNED' }, 1000, [], [], true)).toThrow('Choose a Linear team');
  expect(updateFields(admin, report, { status: 'ASSIGNED' }, 1000, [], [], false)).not.toHaveProperty('linearSyncStatus');
});
it('generates trusted timestamps and denies closed report requests', () => {
  expect(updateFields(actor, report, { updateRequestedAt: '2999-01-01' }, 1000)).toEqual({ updateRequestedAt: '1970-01-01T00:00:01.000Z' });
  expect(() => updateFields(actor, { ...report, status: 'CLOSED' }, { updateRequestedAt: 'x' }, 1000)).toThrow('Unauthorized report change');
});
it('limits admin edits and clears pending requests with server activity', () => {
  expect(updateFields({ ...actor, admin: true }, { ...report, updateRequestedAt: '1970-01-01T00:00:02Z' }, { status: 'ASSIGNED', assignee: null }, 1000)).toEqual({ status: 'ASSIGNED', assignee: null, adminActivityAt: '1970-01-01T00:00:02.001Z', updateRespondedAt: '1970-01-01T00:00:02.001Z' });
  expect(() => updateFields({ ...actor, admin: true }, report, { status: 'CLOSED', owner: 'other' }, 1000)).toThrow('Unauthorized report change');
});

it('does not create a response event for routine admin edits', () => {
  expect(updateFields({ ...actor, admin: true }, report, { status: 'ASSIGNED' }, 1000)).not.toHaveProperty('updateRespondedAt');
  expect(() => updateFields({ ...actor, admin: true }, report, { status: 'ASSIGNED', updateRespondedAt: 'forged' }, 1000)).toThrow('Unauthorized report change');
});
