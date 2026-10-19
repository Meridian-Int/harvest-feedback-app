export function releaseSettings(outputs, target = 'dev') {
  const names = Object.keys(outputs);
  if (!['dev', 'test', 'production'].includes(target) || names.length !== 1 || names[0] !== `harvest-feedback-integration-${target}`) throw new Error('A single matching Feedback stack is required.');
  const settings = outputs[names[0]];
  const production = target === 'production';
  if (settings.UserPoolId !== (production ? 'us-east-2_oadf82ZLn' : 'us-east-2_9T9vblhIf') || settings.UserPoolClientId !== (production ? '2igh4vncukumgslfn9u17ancuo' : '1kgpn379o3obvefdfrms9pp6ho')) throw new Error('Release pool and client must match the HARVEST environment.');
  const api = new URL(settings.GraphqlUrl), site = new URL(settings.FeedbackSiteOrigin);
  if (!/^https:\/\/[a-z0-9]+\.appsync-api\.us-east-2\.amazonaws\.com\/graphql$/.test(api.href) || api.username || api.password || api.search || api.hash) throw new Error('Invalid Feedback GraphQL endpoint.');
  if (!/^https:\/\/[a-z0-9]+\.cloudfront\.net\/$/.test(site.href)) throw new Error('Invalid private static origin.');
  if (!/^[a-z0-9-]+$/.test(settings.UiBucket ?? '') || !/^[A-Z0-9]+$/.test(settings.DistributionId ?? '')) throw new Error('Static release outputs are incomplete.');
  return settings;
}
