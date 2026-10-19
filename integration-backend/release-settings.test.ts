import { expect, it } from 'vitest';
// @ts-expect-error The build-only release helper is plain Node ESM.
import { releaseSettings } from './release-settings.mjs';
const settings = { UserPoolId: 'us-east-2_9T9vblhIf', UserPoolClientId: '1kgpn379o3obvefdfrms9pp6ho', GraphqlUrl: 'https://abc123.appsync-api.us-east-2.amazonaws.com/graphql', FeedbackSiteOrigin: 'https://abc123.cloudfront.net', UiBucket: 'feedback-dev-ui', DistributionId: 'ABC123' };
it('accepts only the matching environment release outputs', () => {
  expect(releaseSettings({ 'harvest-feedback-integration-dev': settings })).toEqual(settings);
  expect(() => releaseSettings({ production: settings })).toThrow('matching Feedback stack');
  expect(() => releaseSettings({ 'harvest-feedback-integration-dev': { ...settings, UserPoolId: 'production' } })).toThrow('match the HARVEST environment');
  expect(() => releaseSettings({ 'harvest-feedback-integration-dev': { ...settings, GraphqlUrl: settings.GraphqlUrl + '?token=secret' } })).toThrow('endpoint');
});

it('keeps production releases on the production pool and stack', () => {
  const live = { ...settings, UserPoolId: 'us-east-2_oadf82ZLn', UserPoolClientId: '2igh4vncukumgslfn9u17ancuo' };
  expect(releaseSettings({ 'harvest-feedback-integration-production': live }, 'production')).toEqual(live);
  expect(() => releaseSettings({ 'harvest-feedback-integration-dev': live }, 'production')).toThrow('matching Feedback stack');
  expect(() => releaseSettings({ 'harvest-feedback-integration-production': settings }, 'production')).toThrow('match the HARVEST environment');
});
