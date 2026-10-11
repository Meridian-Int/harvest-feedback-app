import { parseHarvestViewer } from '../../../src/lib/harvest-membership';

interface ViewerEvent {
  request?: { headers?: Record<string, string | string[] | undefined> };
  identity?: { sub?: string };
}

function tokenSubject(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as unknown;
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
    const subject = (payload as Record<string, unknown>).sub;
    return typeof subject === 'string' && subject.length > 0 ? subject : null;
  } catch {
    return null;
  }
}

function membershipUrl(base: string): string {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('HARVEST membership service is not configured.');
  }
  return new URL('/api/me', url).toString();
}

/** HARVEST verifies the access token and resolves live, non-removed memberships. */
export async function verifyHarvestViewer(token: string | undefined, callerSub: string | undefined) {
  // The Cognito access token is the GraphQL Authorization header. Keep it out
  // of GraphQL arguments, where request/response logging can capture it.
  if (!token || !callerSub || tokenSubject(token) !== callerSub) {
    throw new Error('Could not verify your HARVEST account. Try again.');
  }
  let response: Response;
  try {
    response = await fetch(membershipUrl(process.env.HARVEST_API_BASE_URL ?? ''), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    throw new Error('Could not reach HARVEST to verify your account. Try again.');
  }
  if (!response.ok) throw new Error('Could not verify your HARVEST account. Try again.');
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error('Could not verify your HARVEST account. Try again.');
  }
  return parseHarvestViewer(value);
}

export async function handler(event: ViewerEvent) {
  const rawHeader = event.request?.headers?.authorization ?? event.request?.headers?.Authorization;
  return verifyHarvestViewer(typeof rawHeader === 'string' ? rawHeader : undefined, event.identity?.sub);
}
