import { existsSync, readFileSync } from 'node:fs';

/** Public deployment inputs may come from an ignored laptop file or CI environment. */
export function synthSettings(file = '.env.integration.local', environment = process.env, target = environment.FEEDBACK_TARGET ?? 'dev') {
  const local = Object.fromEntries((existsSync(file) ? readFileSync(file, 'utf8') : '').split(/\r?\n/)
    .filter(line => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map(line => { const separator = line.indexOf('='); return [line.slice(0, separator), line.slice(separator + 1)]; }));
  const get = key => environment[key] || local[key];
  const required = key => {
    const value = get(key);
    if (!value) throw new Error(`Missing public integration setting: ${key}`);
    return value;
  };
  if (!['dev', 'test', 'production'].includes(target)) throw new Error(`Unsupported Feedback target: ${target}`);
  const production = target === 'production';
  return {
    target,
    poolId: required(production ? 'HARVEST_PRODUCTION_USER_POOL_ID' : 'HARVEST_STAGING_USER_POOL_ID'),
    clientId: required(production ? 'HARVEST_PRODUCTION_APP_CLIENT_ID' : 'HARVEST_STAGING_APP_CLIENT_ID'),
    apiUrl: required(production ? 'HARVEST_PRODUCTION_API_BASE_URL' : 'HARVEST_API_BASE_URL'),
    directoryHost: production ? required('HARVEST_PRODUCTION_DB_HOST') : 'harvest-refresh-staging.cj6wauecoveq.us-east-2.rds.amazonaws.com',
    vpcId: production ? required('HARVEST_PRODUCTION_VPC_ID') : 'vpc-04d2f16f7ea4bf404',
    subnetIds: production ? required('HARVEST_PRODUCTION_PRIVATE_SUBNET_IDS').split(',') : ['subnet-03e616552e9cabc65', 'subnet-0cda4f70b6ffe757b'],
    securityGroupId: production ? required('HARVEST_PRODUCTION_DIRECTORY_SECURITY_GROUP_ID') : 'sg-090fc2286105d42e5',
    availabilityZones: production ? required('HARVEST_PRODUCTION_AVAILABILITY_ZONES').split(',') : ['us-east-2a', 'us-east-2b'],
    origins: production ? ['https://harvestbymeridian.ai'] : target === 'dev'
      ? ['https://harvest-refresh-prestaging-meridian.netlify.app', 'https://staging.harvestbymeridian.ai', 'https://harvest-refresh-staging-meridian.netlify.app', 'http://localhost:5173']
      : ['https://staging.harvestbymeridian.ai', 'https://harvest-refresh-staging-meridian.netlify.app'],
    sentryTokenSecretArn: get('FEEDBACK_SENTRY_TOKEN_SECRET_ARN'),
    ga4SecretArn: get('FEEDBACK_GA4_SECRET_ARN'),
    ga4PropertyId: get('FEEDBACK_GA4_PROPERTY_ID'),
  };
}
