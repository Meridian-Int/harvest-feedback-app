import { existsSync, readFileSync } from 'node:fs';

/** Public deployment inputs may come from an ignored laptop file or CI environment. */
export function synthSettings(file = '.env.integration.local', environment = process.env) {
  const local = Object.fromEntries((existsSync(file) ? readFileSync(file, 'utf8') : '').split(/\r?\n/)
    .filter(line => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map(line => { const separator = line.indexOf('='); return [line.slice(0, separator), line.slice(separator + 1)]; }));
  const get = key => environment[key] || local[key];
  const required = key => {
    const value = get(key);
    if (!value) throw new Error(`Missing public integration setting: ${key}`);
    return value;
  };
  return {
    poolId: required('HARVEST_STAGING_USER_POOL_ID'),
    clientId: required('HARVEST_STAGING_APP_CLIENT_ID'),
    apiUrl: required('HARVEST_API_BASE_URL'),
    sentryTokenSecretArn: get('FEEDBACK_SENTRY_TOKEN_SECRET_ARN'),
    ga4SecretArn: get('FEEDBACK_GA4_SECRET_ARN'),
    ga4PropertyId: get('FEEDBACK_GA4_PROPERTY_ID'),
    linearTokenSecretName: get('FEEDBACK_LINEAR_TOKEN_SECRET_NAME'),
  };
}
