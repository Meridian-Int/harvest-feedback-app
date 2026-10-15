import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { X509Certificate } from 'node:crypto';
import pg from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
const secrets = new SecretsManagerClient({});
let pool: pg.Pool | undefined;

export function validDirectoryRequest(event: unknown): void {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('Invalid directory request.');
  const value = event as Record<string, unknown>;
  if (value.operation !== 'harvest-feedback-admin-directory' || Object.keys(value).length !== 1) throw new Error('Invalid directory request.');
}

async function database() {
  if (pool) return pool;
  const target = process.env.FEEDBACK_TARGET;
  if (!['dev', 'test'].includes(target ?? '')) throw new Error('Directory is restricted to non-production.');
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.DIRECTORY_SECRET_ARN }));
  const credentials = JSON.parse(result.SecretString ?? '{}');
  if (credentials.username !== `harvest_feedback_${target}_directory` || typeof credentials.password !== 'string' || credentials.host !== 'harvest-refresh-staging.cj6wauecoveq.us-east-2.rds.amazonaws.com' || credentials.dbname !== 'harvest_refresh') throw new Error('Invalid read-only directory configuration.');
  const certificate = readFileSync(join(process.env.LAMBDA_TASK_ROOT ?? 'integration-backend', 'rds-ca.pem'), 'utf8');
  const roots = (certificate.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? []).filter(pem => {
    const value = new X509Certificate(pem);
    return value.ca && value.subject === value.issuer;
  });
  if (!roots.length) throw new Error('RDS trust roots are missing.');
  pool = new pg.Pool({ host: credentials.host, database: credentials.dbname, user: credentials.username, password: credentials.password, port: 5432, max: 1, connectionTimeoutMillis: 8000, idleTimeoutMillis: 10000, ssl: { ca: roots, rejectUnauthorized: true }, application_name: `harvest-feedback-${target}-directory` });
  return pool;
}

/** IAM-only function with a dedicated column-scoped database login; no master secret. */
export async function handler(event: unknown) {
  validDirectoryRequest(event);
  let client: pg.PoolClient | undefined;
  try {
    client = await (await database()).connect();
    await client.query('BEGIN READ ONLY');
    const result = await client.query(
      `SELECT DISTINCT p.idp_subject AS sub, p.email, p.name
         FROM people p JOIN memberships m ON m.person_id = p.id
         JOIN organisations o ON o.id = m.organisation_id
        WHERE m.removed_at IS NULL AND o.kind = 'operator'
        LIMIT 101`,
    );
    if (result.rows.length > 100) throw new Error('Administrator directory exceeds its configured bound.');
    await client.query('COMMIT');
    return result.rows;
  } catch {
    await client?.query('ROLLBACK').catch(() => undefined);
    throw new Error('Trusted HARVEST membership lookup failed.');
  } finally { client?.release(); }
}
