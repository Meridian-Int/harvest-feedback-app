import { parseHarvestViewer, type HarvestViewer } from '../src/lib/harvest-membership';
import { CognitoIdentityProviderClient, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({ region: 'us-east-2' });

export interface Actor { sub: string; viewer: HarvestViewer; admin: boolean }
export interface Event {
  arguments: Record<string, any>;
  info: { fieldName: string };
  request?: { headers?: Record<string, string | undefined> };
  identity?: { sub?: string; issuer?: string; claims?: Record<string, unknown> };
}

/** AppSync verifies the signature; HARVEST independently verifies this access token. */
export async function authorize(
  event: Event,
  assignment: (sub: string) => Promise<{ enabled?: boolean } | null>,
  request: typeof fetch = fetch,
): Promise<Actor> {
  const pool = process.env.HARVEST_USER_POOL_ID;
  const client = process.env.HARVEST_APP_CLIENT_ID;
  const identity = event.identity;
  const token = event.request?.headers?.authorization ?? event.request?.headers?.Authorization;
  if (!pool || !client || !token || !identity?.sub ||
      identity.issuer !== `https://cognito-idp.us-east-2.amazonaws.com/${pool}` ||
      identity.claims?.token_use !== 'access' || identity.claims.client_id !== client) {
    throw new Error('Unauthorized');
  }
  // JWT signature validation alone does not observe Cognito token revocation.
  try {
    const user = await cognito.send(new GetUserCommand({ AccessToken: token }));
    if (user.UserAttributes?.find(attribute => attribute.Name === 'sub')?.Value !== identity.sub) throw new Error('Unauthorized');
  } catch { throw new Error('Unauthorized'); }
  const base = new URL(process.env.HARVEST_API_BASE_URL ?? '');
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('Unauthorized');
  const response = await request(new URL('/api/me', base), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error('Unauthorized');
  const viewer = parseHarvestViewer(await response.json());
  const selected = await assignment(identity.sub);
  return {
    sub: identity.sub, viewer,
    admin: selected?.enabled === true && viewer.memberships.some(m => m.orgKind === 'operator'),
  };
}

export function organization(actor: Actor, id: unknown) {
  const membership = actor.viewer.memberships.find(m => m.orgId === id);
  if (!membership) throw new Error('Choose an active HARVEST organization.');
  return membership;
}

export function canRead(actor: Actor, report: { owner?: string; organizationId?: string }) {
  return actor.admin || (report.owner === actor.sub && actor.viewer.memberships.some(m => m.orgId === report.organizationId));
}

/** No email fallback, Cognito group shortcut, or browser-supplied owner identity. */
export function requireReport(actor: Actor, report: { owner?: string; organizationId?: string } | null) {
  if (!report || !canRead(actor, report)) throw new Error('Report unavailable.');
}

export function updateFields(actor: Actor, report: { owner?: string; organizationId?: string; status: string; updateRequestedAt?: string; adminActivityAt?: string }, input: Record<string, unknown>, now: number, selectedOwners: string[] = []) {
  requireReport(actor, report);
  const keys = Object.keys(input).filter(k => k !== 'id');
  const allowed = actor.admin ? ['status', 'assignee', 'adminActivityAt'] : ['updateRequestedAt'];
  if (!keys.length || keys.some(k => !allowed.includes(k))) throw new Error('Unauthorized report change.');
  if (!actor.admin) {
    if (report.owner !== actor.sub || report.status === 'CLOSED') throw new Error('Unauthorized report change.');
    if (report.updateRequestedAt && Date.parse(report.updateRequestedAt) > Date.parse(report.adminActivityAt ?? '1970-01-01')) return {};
    return { updateRequestedAt: new Date(Math.max(now, Date.parse(report.adminActivityAt ?? '1970-01-01') + 1)).toISOString() };
  }
  if (!['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'].includes(String(input.status))) throw new Error('Choose a valid status.');
  // The preserved Admin option names the queue; it is never an email recipient.
  if (input.assignee != null && input.assignee !== '' && input.assignee !== 'admin@example.com' && !selectedOwners.includes(String(input.assignee))) throw new Error('Choose a valid owner.');
  return {
    status: input.status, assignee: input.assignee || null,
    adminActivityAt: new Date(Math.max(now, Date.parse(report.updateRequestedAt ?? '1970-01-01') + 1)).toISOString(),
  };
}
