import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

type SentryRow = {
  id?: string;
  title?: string;
  culprit?: string;
  project?: { slug?: string };
  level?: string;
  count?: string | number;
  userCount?: number;
  lastSeen?: string;
  permalink?: string;
  stats?: { '24h'?: [number, number][] };
};

type SentryConfig = { secretArn?: string; org: string; project: string; environment: string };
type TokenReader = (secretArn: string) => Promise<string>;
type Fetcher = (url: URL, init: RequestInit) => Promise<Response>;

const secrets = new SecretsManagerClient({});

async function readToken(secretArn: string): Promise<string> {
  const secret = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const token = secret.SecretString?.trim();
  if (!token) throw new Error('Feedback Sentry token secret is empty.');
  return token;
}

const count = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(2147483647, Math.trunc(parsed))) : 0;
};

/** Read HARVEST issues only after the resolver has verified an active Feedback admin. */
export async function readSentryIssues(config: SentryConfig, tokenReader: TokenReader = readToken, fetcher: Fetcher = fetch) {
  if (!config.secretArn) return { configured: false, issues: [] };
  const token = await tokenReader(config.secretArn);
  const url = new URL(`https://sentry.io/api/0/organizations/${encodeURIComponent(config.org)}/issues/`);
  url.searchParams.set('project', config.project);
  url.searchParams.set('environment', config.environment);
  url.searchParams.set('query', 'is:unresolved');
  url.searchParams.set('statsPeriod', '14d');
  url.searchParams.set('groupStatsPeriod', '24h');
  url.searchParams.set('sort', 'freq');
  url.searchParams.set('limit', '100');
  const response = await fetcher(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Sentry issues request failed (${response.status}).`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error('Sentry issues response was invalid.');
  return { configured: true, issues: (rows as SentryRow[]).filter(row => row && row.id).map(row => ({
    id: String(row.id),
    title: row.title ?? '',
    culprit: row.culprit ?? '',
    project: row.project?.slug ?? config.project,
    level: row.level ?? 'error',
    count: count(row.count),
    userCount: count(row.userCount),
    lastSeen: row.lastSeen ?? '',
    permalink: row.permalink ?? '',
    trend: (row.stats?.['24h'] ?? []).map(point => count(point[1])),
  })) };
}

export function readConfiguredSentryIssues() {
  return readSentryIssues({
    secretArn: process.env.SENTRY_TOKEN_SECRET_ARN,
    org: process.env.SENTRY_ORG ?? 'meridian-zt',
    project: process.env.SENTRY_PROJECT ?? 'javascript-react',
    environment: process.env.SENTRY_ENVIRONMENT ?? 'prestaging',
  });
}
