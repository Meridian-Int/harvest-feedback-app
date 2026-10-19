import { expect, test } from 'vitest';
import { releaseManifest } from './release-settings.mjs';

const stack = {
  UserPoolId: 'us-east-2_9T9vblhIf',
  UserPoolClientId: '1kgpn379o3obvefdfrms9pp6ho',
  GraphqlUrl: 'https://abc123.appsync-api.us-east-2.amazonaws.com/graphql',
  FeedbackSiteOrigin: 'https://abc123.cloudfront.net',
  UiBucket: 'feedback-ui-dev',
  DistributionId: 'ABC123',
};

test('release manifest binds the checked dev stack to HARVEST prestaging settings', () => {
  expect(releaseManifest({ 'harvest-feedback-integration-dev': stack })).toEqual({
    target: 'dev', userPoolId: stack.UserPoolId, userPoolClientId: stack.UserPoolClientId,
    graphqlUrl: stack.GraphqlUrl, siteOrigin: stack.FeedbackSiteOrigin,
  });
});

test('test stack gets its own target and a production or mismatched identity is rejected', () => {
  expect(releaseManifest({ 'harvest-feedback-integration-test': stack }).target).toBe('test');
  expect(() => releaseManifest({ 'harvest-feedback-integration-production': stack })).toThrow(/non-production/);
  expect(() => releaseManifest({ 'harvest-feedback-integration-dev': { ...stack, UserPoolId: 'production-pool' } })).toThrow(/staging pool/);
});
