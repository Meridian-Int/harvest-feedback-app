import { expect, it } from 'vitest';
// @ts-expect-error The build-only release helper is plain Node ESM.
import { releaseSettings } from './release-settings.mjs';
const settings = { UserPoolId: 'us-east-2_9T9vblhIf', UserPoolClientId: '1kgpn379o3obvefdfrms9pp6ho', GraphqlUrl: 'https://abc123.appsync-api.us-east-2.amazonaws.com/graphql', FeedbackSiteOrigin: 'https://abc123.cloudfront.net', UiBucket: 'feedback-dev-ui', DistributionId: 'ABC123' };
it('accepts only the dedicated non-production release outputs', () => {
  expect(releaseSettings({ 'harvest-feedback-integration-dev': settings })).toEqual(settings);
  expect(() => releaseSettings({ production: settings })).toThrow('non-production');
  expect(() => releaseSettings({ 'harvest-feedback-integration-dev': { ...settings, UserPoolId: 'production' } })).toThrow('staging pool');
  expect(() => releaseSettings({ 'harvest-feedback-integration-dev': { ...settings, GraphqlUrl: settings.GraphqlUrl + '?token=secret' } })).toThrow('endpoint');
});
