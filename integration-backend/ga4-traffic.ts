import { createSign } from 'node:crypto';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

type Config = { secretArn?: string; propertyId?: string };
type SecretReader = (secretArn: string) => Promise<string>;
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
type ReportRow = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
type Report = { rows?: ReportRow[] };

const secrets = new SecretsManagerClient({});
const empty = () => ({ configured: false, users: 0, sessions: 0, pageViews: 0, days: [], pages: [] });
const integer = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(2147483647, Math.trunc(parsed))) : 0;
};

async function readSecret(secretArn: string) {
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!result.SecretString) throw new Error('HARVEST GA4 credential secret is empty.');
  return result.SecretString;
}

function signedAssertion(email: string, privateKey: string, now: number) {
  const issued = Math.floor(now / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: issued, exp: issued + 3600 })).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${signer.sign(privateKey).toString('base64url')}`;
}

/** Server-side GA4 read for a verified Feedback admin; no credential reaches the browser. */
export async function readGa4Traffic(config: Config, secretReader: SecretReader = readSecret, fetcher: Fetcher = fetch, now = Date.now()) {
  if (!config.secretArn || !config.propertyId) return empty();
  if (!/^\d+$/.test(config.propertyId)) throw new Error('Invalid GA4 property ID.');
  const secret = JSON.parse(await secretReader(config.secretArn)) as { client_email?: string; private_key?: string };
  if (!secret.client_email || !secret.private_key) throw new Error('HARVEST GA4 credential secret is invalid.');
  const auth = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signedAssertion(secret.client_email, secret.private_key, now) }).toString(),
    signal: AbortSignal.timeout(10000),
  });
  if (!auth.ok) throw new Error(`Google authentication failed (${auth.status}).`);
  const { access_token: token } = await auth.json() as { access_token?: string };
  if (!token) throw new Error('Google authentication returned no access token.');

  const report = async (dimensions: string[], metrics: string[], limit: number): Promise<Report> => {
    const response = await fetcher(`https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runReport`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }], dimensions: dimensions.map(name => ({ name })), metrics: metrics.map(name => ({ name })), limit,
        ...(dimensions.includes('pagePath') ? { orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }] } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`GA4 report request failed (${response.status}).`);
    return response.json() as Promise<Report>;
  };

  const [totals, daily, topPages] = await Promise.all([
    report([], ['activeUsers', 'sessions', 'screenPageViews'], 1),
    report(['date'], ['activeUsers'], 7),
    report(['pagePath'], ['screenPageViews'], 5),
  ]);
  const total = totals.rows?.[0]?.metricValues ?? [];
  return {
    configured: true,
    users: integer(total[0]?.value), sessions: integer(total[1]?.value), pageViews: integer(total[2]?.value),
    days: (daily.rows ?? []).map(row => ({ day: String(row.dimensionValues?.[0]?.value ?? ''), users: integer(row.metricValues?.[0]?.value) })).filter(row => /^\d{8}$/.test(row.day)).sort((a, b) => a.day.localeCompare(b.day)),
    pages: (topPages.rows ?? []).map(row => ({ name: String(row.dimensionValues?.[0]?.value ?? ''), views: integer(row.metricValues?.[0]?.value) })).filter(row => row.name),
  };
}

export function readConfiguredGa4Traffic() {
  return readGa4Traffic({ secretArn: process.env.GA4_SECRET_ARN, propertyId: process.env.GA4_PROPERTY_ID });
}
