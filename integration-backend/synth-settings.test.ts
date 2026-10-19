import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error The synthesis settings helper is plain Node ESM.
import { synthSettings } from './synth-settings.mjs';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

it('accepts public CI settings without a laptop env file', () => {
  const settings = synthSettings('missing-in-ci.env', {
    HARVEST_STAGING_USER_POOL_ID: 'pool', HARVEST_STAGING_APP_CLIENT_ID: 'client', HARVEST_API_BASE_URL: 'https://api.example/',
    FEEDBACK_GA4_PROPERTY_ID: '558205575', FEEDBACK_SENTRY_TOKEN_SECRET_ARN: 'arn:example:sentry',
  });
  expect(settings).toMatchObject({ poolId: 'pool', clientId: 'client', apiUrl: 'https://api.example/', ga4PropertyId: '558205575', sentryTokenSecretArn: 'arn:example:sentry' });
  expect(settings.origins).toContain('https://staging.harvestbymeridian.ai');
});

it('lets CI override laptop values and keeps digits in setting names', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'feedback-synth-'));
  directories.push(directory);
  const file = path.join(directory, '.env.integration.local');
  writeFileSync(file, 'HARVEST_STAGING_USER_POOL_ID=old\nHARVEST_STAGING_APP_CLIENT_ID=client\nHARVEST_API_BASE_URL=https://api.example/\nFEEDBACK_GA4_PROPERTY_ID=123\n');
  expect(synthSettings(file, { HARVEST_STAGING_USER_POOL_ID: 'new', FEEDBACK_GA4_PROPERTY_ID: '558205575' })).toMatchObject({ poolId: 'new', ga4PropertyId: '558205575' });
});

it('fails before synthesis when the required HARVEST identity setting is absent', () => {
  expect(() => synthSettings('missing-in-ci.env', {})).toThrow('Missing public integration setting: HARVEST_STAGING_USER_POOL_ID');
});

it('requires distinct production identity and directory inputs', () => {
  const production = {
    FEEDBACK_TARGET: 'production', HARVEST_PRODUCTION_USER_POOL_ID: 'production-pool',
    HARVEST_PRODUCTION_APP_CLIENT_ID: 'production-client', HARVEST_PRODUCTION_API_BASE_URL: 'https://production.example/',
    HARVEST_PRODUCTION_DB_HOST: 'harvest-refresh-production.example.us-east-2.rds.amazonaws.com',
    HARVEST_PRODUCTION_VPC_ID: 'vpc-123', HARVEST_PRODUCTION_PRIVATE_SUBNET_IDS: 'subnet-111,subnet-222',
    HARVEST_PRODUCTION_DIRECTORY_SECURITY_GROUP_ID: 'sg-123', HARVEST_PRODUCTION_AVAILABILITY_ZONES: 'us-east-2a,us-east-2b',
  };
  expect(synthSettings('missing-in-ci.env', production)).toMatchObject({
    target: 'production', poolId: 'production-pool', clientId: 'production-client',
    origins: ['https://harvestbymeridian.ai'], subnetIds: ['subnet-111', 'subnet-222'],
  });
  expect(() => synthSettings('missing-in-ci.env', { ...production, HARVEST_PRODUCTION_DB_HOST: '' })).toThrow('HARVEST_PRODUCTION_DB_HOST');
  expect(() => synthSettings('missing-in-ci.env', { ...production, FEEDBACK_TARGET: 'invalid' })).toThrow('Unsupported Feedback target');
});
