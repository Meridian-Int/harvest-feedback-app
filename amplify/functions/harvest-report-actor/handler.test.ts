import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ viewer: vi.fn() }));
vi.mock('../harvest-viewer/handler', () => ({ verifyHarvestViewer: mocks.viewer }));
import { handler } from './handler';

const stagingIssuer = 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_STAGE';
const event = {
  arguments: { organizationId: 'company-1' },
  request: { headers: { authorization: 'access-token' } },
  identity: { sub: 'sub-1', username: 'client@example.com', issuer: stagingIssuer, groups: [] as string[] },
};

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('passes old Feedback pool users through without calling HARVEST', async () => {
  vi.stubEnv('HARVEST_STAGING_USER_POOL_ID', 'us-east-2_STAGE');
  vi.stubEnv('FEEDBACK_USER_POOL_ID', 'us-east-2_OLD');
  await expect(handler({ ...event, identity: { ...event.identity, issuer: 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_OLD' } })).resolves.toBeNull();
  expect(mocks.viewer).not.toHaveBeenCalled();
});

it('derives reporter fields only from a live HARVEST membership', async () => {
  vi.stubEnv('HARVEST_STAGING_USER_POOL_ID', 'us-east-2_STAGE');
  mocks.viewer.mockResolvedValue({ person: { id: 'person-1', email: 'client@example.com', name: 'Client' }, memberships: [
    { orgId: 'company-1', orgKind: 'company', orgName: 'Company One' },
  ] });
  await expect(handler(event)).resolves.toMatchObject({ reporterEmail: 'client@example.com', persona: 'Company', company: 'Company One', sub: 'sub-1', admin: false });
  await expect(handler({ ...event, arguments: { organizationId: 'other' } })).rejects.toThrow('active HARVEST organization');
});

it('requires both the selected admin group and live Operator membership for Sentry reports', async () => {
  vi.stubEnv('HARVEST_STAGING_USER_POOL_ID', 'us-east-2_STAGE');
  mocks.viewer.mockResolvedValue({ person: { id: 'person-1', email: 'operator@example.com', name: 'Operator' }, memberships: [
    { orgId: 'operator-1', orgKind: 'operator', orgName: 'Meridian' },
  ] });
  const sentry = { ...event, arguments: { organizationId: 'operator-1', sentryIssueId: 'issue-1' } };
  await expect(handler(sentry)).rejects.toThrow('Admin access required');
  await expect(handler({ ...sentry, identity: { ...event.identity, groups: ['feedback-admins'] } })).resolves.toMatchObject({ admin: true });
});

it('rejects an unrecognized Cognito issuer', async () => {
  vi.stubEnv('HARVEST_STAGING_USER_POOL_ID', 'us-east-2_STAGE');
  await expect(handler({ ...event, identity: { ...event.identity, issuer: 'https://elsewhere.example.com' } })).rejects.toThrow('Unrecognized');
});
