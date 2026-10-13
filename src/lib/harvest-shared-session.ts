import { harvestAccount } from './harvest-account';
import { fetchHarvestViewer } from './harvest-viewer';
import type { AuthUser } from './types';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

/** HARVEST stores this session on its own origin for its other tabs. */
export const HARVEST_SESSION_KEY = 'harvest-refresh.session.v1';

interface HarvestTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readHarvestTokens(storage: Pick<Storage, 'getItem'>): HarvestTokens | null {
  let raw: string | null;
  try { raw = storage.getItem(HARVEST_SESSION_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || typeof value.accessToken !== 'string' || !value.accessToken ||
        typeof value.idToken !== 'string' || !value.idToken ||
        typeof value.refreshToken !== 'string' || !value.refreshToken ||
        typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt)) return null;
    return { accessToken: value.accessToken, idToken: value.idToken, refreshToken: value.refreshToken, expiresAt: value.expiresAt };
  } catch { return null; }
}

export function requireSharedHarvestTokens(storage: Pick<Storage, 'getItem'> = localStorage): HarvestTokens {
  const tokens = readHarvestTokens(storage);
  if (!tokens) throw new Error('Open Feedback from your HARVEST workspace.');
  if (tokens.expiresAt <= Date.now() + 30_000) {
    throw new Error('Your HARVEST session needs refreshing. Open Feedback again from HARVEST.');
  }
  return tokens;
}

type RefreshResult = { accessToken: string; idToken: string; expiresAt: number };
type Refresh = (refreshToken: string) => Promise<RefreshResult>;

async function refreshWithCognito(refreshToken: string): Promise<RefreshResult> {
  const poolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const clientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID;
  if (!poolId || !clientId) throw new Error('HARVEST session refresh is not configured.');
  const region = poolId.split('_')[0];
  const result = await new CognitoIdentityProviderClient({ region }).send(new InitiateAuthCommand({
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: clientId,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  }));
  const renewed = result.AuthenticationResult;
  if (!renewed?.AccessToken || !renewed.IdToken || !renewed.ExpiresIn) {
    throw new Error('HARVEST session refresh returned no usable tokens.');
  }
  return {
    accessToken: renewed.AccessToken,
    idToken: renewed.IdToken,
    expiresAt: Date.now() + renewed.ExpiresIn * 1000,
  };
}

/** Refresh the same HARVEST session, then share the renewed tokens with its other tabs. */
export async function getUsableHarvestTokens(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  refresh: Refresh = refreshWithCognito,
): Promise<HarvestTokens> {
  const current = readHarvestTokens(storage);
  if (!current) throw new Error('Open Feedback from your HARVEST workspace.');
  if (current.expiresAt > Date.now() + 30_000) return current;
  let renewed: RefreshResult;
  try { renewed = await refresh(current.refreshToken); }
  catch {
    const newer = readHarvestTokens(storage);
    if (newer && newer.expiresAt > Date.now() + 30_000) return newer;
    throw new Error('Your HARVEST session needs refreshing. Open Feedback again from HARVEST.');
  }
  const latest = readHarvestTokens(storage);
  if (!latest || latest.refreshToken !== current.refreshToken) {
    throw new Error('Your HARVEST session changed. Open Feedback again from HARVEST.');
  }
  if (latest.expiresAt > renewed.expiresAt) return latest;
  const tokens = { ...current, ...renewed };
  try { storage.setItem(HARVEST_SESSION_KEY, JSON.stringify(tokens)); }
  catch { /* This tab can still use the renewed tokens. */ }
  return tokens;
}

function idClaims(idToken: string): { sub: string; groups: string[] } {
  try {
    const payload = idToken.split('.')[1];
    if (!payload) throw new Error('Invalid token');
    const decoded: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (!record(decoded) || typeof decoded.sub !== 'string' || !decoded.sub) throw new Error('Invalid token');
    const groups = Array.isArray(decoded['cognito:groups'])
      ? decoded['cognito:groups'].filter((group): group is string => typeof group === 'string') : [];
    return { sub: decoded.sub, groups };
  } catch { throw new Error('Your HARVEST session could not be read. Open Feedback again from HARVEST.'); }
}

/** Reuse the HARVEST tab's session; the Feedback backend verifies the access token. */
export async function restoreSharedHarvestSession(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  selectedOrgId: string | null = new URLSearchParams(location.search).get('org'),
): Promise<AuthUser | null> {
  if (!readHarvestTokens(storage)) return null;
  const tokens = await getUsableHarvestTokens(storage);
  const claims = idClaims(tokens.idToken);
  const viewer = await fetchHarvestViewer(tokens.accessToken);
  if (readHarvestTokens(storage)?.refreshToken !== tokens.refreshToken) {
    throw new Error('Your HARVEST session changed. Open Feedback again from HARVEST.');
  }
  const organizationKey = `harvest:organization:${viewer.person.id}`;
  const selection = selectedOrgId ?? storage.getItem(organizationKey) ?? undefined;
  const user = harvestAccount(viewer, claims.sub, viewer.feedbackAdmin === true ? ['feedback-admins'] : [], selection);
  if (selectedOrgId && user.harvest?.selectedOrganizationId === selectedOrgId) {
    try { storage.setItem(organizationKey, selectedOrgId); } catch { /* The current tab still has the selection. */ }
  }
  return user;
}
