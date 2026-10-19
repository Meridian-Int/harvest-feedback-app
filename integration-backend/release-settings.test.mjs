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

test('each target gets its matching manifest and rejects the wrong identity', () => {
  expect(releaseManifest({ 'harvest-feedback-integration-test': stack }, 'test').target).toBe('test');
  const production = { ...stack, UserPoolId: 'us-east-2_oadf82ZLn', UserPoolClientId: '2igh4vncukumgslfn9u17ancuo' };
  expect(releaseManifest({ 'harvest-feedback-integration-production': production }, 'production').target).toBe('production');
  expect(() => releaseManifest({ 'harvest-feedback-integration-production': stack }, 'production')).toThrow(/HARVEST environment/);
  expect(() => releaseManifest({ 'harvest-feedback-integration-dev': production })).toThrow(/HARVEST environment/);
});
