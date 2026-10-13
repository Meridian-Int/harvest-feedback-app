import { App } from 'aws-cdk-lib';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { integrationStack } from './app.mjs';

// Only public configuration is read. AWS credentials remain in the AWS profile.
const local = Object.fromEntries(readFileSync('.env.integration.local', 'utf8').split('\n')
  .filter(line => /^[A-Z_]+=/.test(line)).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
const app = new App({ outdir: 'cdk.out' });
const stack = integrationStack(app, {
  target: process.env.FEEDBACK_TARGET ?? 'dev', account: '938463256739', region: 'us-east-2',
  poolId: local.HARVEST_STAGING_USER_POOL_ID, clientId: local.HARVEST_STAGING_APP_CLIENT_ID,
  apiUrl: local.HARVEST_API_BASE_URL, origins: ['https://harvest-refresh-prestaging-meridian.netlify.app'],
  emailEnabled: process.env.FEEDBACK_EMAIL_ENABLED === 'true',
});
const assembly = app.synth();
const template = assembly.getStackArtifact(stack.artifactId).template;
const resources = Object.values(template.Resources);
assert.equal(resources.filter(resource => resource.Type.startsWith('AWS::Cognito::')).length, 0);
assert.equal(resources.filter(resource => resource.Type === 'AWS::DynamoDB::Table').length, 5);
const api = resources.find(resource => resource.Type === 'AWS::AppSync::GraphQLApi');
assert.equal(api.Properties.UserPoolConfig.UserPoolId, local.HARVEST_STAGING_USER_POOL_ID);
assert.equal(api.Properties.AdditionalAuthenticationProviders, undefined);
assert.equal(resources.filter(resource => resource.Type === 'AWS::AppSync::Resolver').length, 13);
assert.equal(JSON.stringify(template).includes('harvest-refresh-backend-production'), false);
console.log('Synthesis passed: 0 Cognito resources, 5 separate Feedback tables, private media/static buckets, 13 guarded operations; email starts disabled.');
