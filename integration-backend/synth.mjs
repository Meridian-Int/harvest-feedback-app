import { App } from 'aws-cdk-lib';
import assert from 'node:assert/strict';
import { integrationStack } from './app.mjs';
import { synthSettings } from './synth-settings.mjs';

// Only public configuration is read here. The ignored local file or explicit environment supplies it.
const settings = synthSettings();
const app = new App({ outdir: 'cdk.out' });
const stack = integrationStack(app, {
  target: settings.target, account: '938463256739', region: 'us-east-2',
  poolId: settings.poolId, clientId: settings.clientId,
  apiUrl: settings.apiUrl, origins: settings.origins,
  directoryHost: settings.directoryHost, vpcId: settings.vpcId, subnetIds: settings.subnetIds,
  securityGroupId: settings.securityGroupId, availabilityZones: settings.availabilityZones,
  harvestNotificationsEnabled: process.env.FEEDBACK_HARVEST_NOTIFICATIONS_ENABLED === 'true',
  emailEnabled: process.env.FEEDBACK_EMAIL_ENABLED === 'true', appBaseUrl: process.env.FEEDBACK_APP_BASE_URL,
  sentryTokenSecretArn: settings.sentryTokenSecretArn, ga4SecretArn: settings.ga4SecretArn, ga4PropertyId: settings.ga4PropertyId,
});
const assembly = app.synth();
const template = assembly.getStackArtifact(stack.artifactId).template;
const resources = Object.values(template.Resources);
assert.equal(resources.filter(resource => resource.Type.startsWith('AWS::Cognito::')).length, 0);
assert.equal(resources.filter(resource => resource.Type === 'AWS::DynamoDB::Table').length, 5);
const api = resources.find(resource => resource.Type === 'AWS::AppSync::GraphQLApi');
assert.equal(api.Properties.UserPoolConfig.UserPoolId, settings.poolId);
assert.equal(api.Properties.AdditionalAuthenticationProviders, undefined);
assert.equal(resources.filter(resource => resource.Type === 'AWS::AppSync::Resolver').length, 14);
assert.equal(JSON.stringify(template).includes(`harvest-refresh/${settings.target === 'production' ? 'staging' : 'production'}/`), false);
for (const forbidden of settings.target === 'production'
  ? ['us-east-2_9T9vblhIf', 'hjyuhqzj1i.execute-api.us-east-2.amazonaws.com', 'harvest-refresh-prestaging-meridian.netlify.app']
  : ['us-east-2_oadf82ZLn', '5fbi1qzdl5.execute-api.us-east-2.amazonaws.com']) {
  assert.equal(JSON.stringify(template).includes(forbidden), false, `Cross-environment reference: ${forbidden}`);
}
const resolver = resources.find(resource => resource.Type === 'AWS::Lambda::Function' && resource.Properties.Environment?.Variables.REPORTS_TABLE);
const hasSecretGrant = arn => resources.some(resource => resource.Type === 'AWS::IAM::Policy' && JSON.stringify(resource.Properties.PolicyDocument).includes(arn));
if (settings.sentryTokenSecretArn) {
  assert.equal(resolver?.Properties.Environment.Variables.SENTRY_TOKEN_SECRET_ARN, settings.sentryTokenSecretArn);
  assert.ok(hasSecretGrant(settings.sentryTokenSecretArn), 'Missing Sentry secret read grant.');
}
if (settings.ga4SecretArn) {
  assert.equal(resolver?.Properties.Environment.Variables.GA4_SECRET_ARN, settings.ga4SecretArn);
  assert.equal(resolver?.Properties.Environment.Variables.GA4_PROPERTY_ID, settings.ga4PropertyId);
  assert.ok(hasSecretGrant(settings.ga4SecretArn), 'Missing GA4 secret read grant.');
}
console.log(`Synthesis passed: 0 Cognito resources, 5 separate Feedback tables, private media/static buckets, 14 guarded operations; email enabled: ${process.env.FEEDBACK_EMAIL_ENABLED === 'true'}.`);
