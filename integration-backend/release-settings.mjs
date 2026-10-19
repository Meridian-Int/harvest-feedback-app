export function releaseSettings(outputs) {
  const names = Object.keys(outputs);
  if (names.length !== 1 || !['harvest-feedback-integration-dev', 'harvest-feedback-integration-test'].includes(names[0])) throw new Error('A single non-production Feedback stack is required.');
  const settings = outputs[names[0]];
  if (settings.UserPoolId !== 'us-east-2_9T9vblhIf' || settings.UserPoolClientId !== '1kgpn379o3obvefdfrms9pp6ho') throw new Error('Release must use the verified HARVEST staging pool and client.');
  const api = new URL(settings.GraphqlUrl), site = new URL(settings.FeedbackSiteOrigin);
  if (!/^https:\/\/[a-z0-9]+\.appsync-api\.us-east-2\.amazonaws\.com\/graphql$/.test(api.href) || api.username || api.password || api.search || api.hash) throw new Error('Invalid staging GraphQL endpoint.');
  if (!/^https:\/\/[a-z0-9]+\.cloudfront\.net\/$/.test(site.href)) throw new Error('Invalid private static origin.');
  if (!/^[a-z0-9-]+$/.test(settings.UiBucket ?? '') || !/^[A-Z0-9]+$/.test(settings.DistributionId ?? '')) throw new Error('Static release outputs are incomplete.');
  return settings;
}

/** The HARVEST build accepts only a manifest made from checked stack outputs. */
export function releaseManifest(outputs) {
  const settings = releaseSettings(outputs);
  const stackName = Object.keys(outputs)[0];
  return {
    target: stackName.endsWith('-dev') ? 'dev' : 'test',
    userPoolId: settings.UserPoolId,
    userPoolClientId: settings.UserPoolClientId,
    graphqlUrl: settings.GraphqlUrl,
    siteOrigin: settings.FeedbackSiteOrigin,
  };
}
