import { verifyHarvestViewer } from '../harvest-viewer/handler';

interface ActorEvent {
  arguments: { organizationId?: string; sentryIssueId?: string };
  request?: { headers?: Record<string, string | string[] | undefined> };
  identity?: { sub?: string; issuer?: string; groups?: string[]; username?: string };
}

/** Returns null only for the existing Feedback pool during the migration. */
export async function handler(event: ActorEvent) {
  const poolId = process.env.HARVEST_STAGING_USER_POOL_ID;
  if (!poolId) throw new Error('HARVEST staging is not configured.');
  const issuer = `https://cognito-idp.us-east-2.amazonaws.com/${poolId}`;
  const feedbackIssuer = `https://cognito-idp.us-east-2.amazonaws.com/${process.env.FEEDBACK_USER_POOL_ID}`;
  if (event.identity?.issuer === feedbackIssuer) return null;
  if (event.identity?.issuer !== issuer) throw new Error('Unrecognized sign-in provider.');
  const rawHeader = event.request?.headers?.authorization ?? event.request?.headers?.Authorization;
  const viewer = await verifyHarvestViewer(typeof rawHeader === 'string' ? rawHeader : undefined, event.identity?.sub);
  const organization = viewer.memberships.find(item => item.orgId === event.arguments.organizationId);
  if (!organization) throw new Error('Choose an active HARVEST organization.');
  const admin = Boolean(event.identity?.groups?.includes('feedback-admins') &&
    viewer.memberships.some(item => item.orgKind === 'operator'));
  if (event.arguments.sentryIssueId && !admin) throw new Error('Admin access required.');
  return {
    sub: event.identity?.sub,
    username: event.identity?.username,
    reporterName: viewer.person.name ?? viewer.person.email,
    reporterEmail: viewer.person.email,
    persona: organization.orgKind === 'company' ? 'Company'
      : organization.orgKind === 'partner' ? 'Partner' : 'Operator',
    company: organization.orgName,
    admin,
  };
}
