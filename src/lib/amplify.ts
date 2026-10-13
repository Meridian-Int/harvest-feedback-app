import { Amplify, type ResourcesConfig } from 'aws-amplify';

// Amplify Hosting writes this file for each branch before the Vite build.
// Local builds remain possible before a sandbox has been created.
const outputs = import.meta.glob('../../amplify_outputs.json', { eager: true, import: 'default' });
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID;
const harvestStaging = import.meta.env.VITE_HARVEST_AUTH_MODE === 'staging';
const harvestShared = import.meta.env.VITE_HARVEST_AUTH_MODE === 'shared';
// Auth can connect to an existing Cognito pool without deploying an Amplify
// sandbox (which also provisions Data and Storage in this foundation).
const authOnly: ResourcesConfig | undefined = userPoolId && userPoolClientId ? {
  Auth: { Cognito: { userPoolId, userPoolClientId, loginWith: { email: true } } },
} : undefined;
const generated = Object.values(outputs)[0] as ResourcesConfig | undefined;
const identityPoolId = generated?.Auth?.Cognito && 'identityPoolId' in generated.Auth.Cognito
  ? generated.Auth.Cognito.identityPoolId : undefined;
// Integrated mode uses only its dedicated API and HARVEST's pool. Legacy
// generated outputs can never fill a missing integrated configuration.
const sharedEndpoint = import.meta.env.VITE_FEEDBACK_GRAPHQL_URL;
const config: ResourcesConfig | undefined = harvestShared && sharedEndpoint && userPoolId && userPoolClientId
  ? { Auth: { Cognito: { userPoolId, userPoolClientId } }, API: { GraphQL: { endpoint: sharedEndpoint, region: 'us-east-2', defaultAuthMode: 'userPool' } } }
  : harvestShared ? undefined : harvestStaging
  ? generated && identityPoolId && userPoolId && userPoolClientId ? {
    ...generated,
    Auth: { Cognito: { userPoolId, userPoolClientId, identityPoolId, loginWith: { email: true } } },
  } : undefined
  : generated ?? authOnly;

if (config) Amplify.configure(config);

export function isAmplifyConfigured(): boolean {
  return Boolean(config);
}

export function requireAmplify(): void {
  if (!config) throw new Error('Harvest sign-in is not configured yet.');
}

/** Activated only with a Feedback backend wired to HARVEST staging Cognito. */
export function isHarvestPasswordMode(): boolean {
  return import.meta.env.VITE_HARVEST_AUTH_MODE === 'staging';
}

/** Feedback is served by HARVEST and reads the session on the same origin. */
export function isHarvestSharedSessionMode(): boolean {
  return import.meta.env.VITE_HARVEST_AUTH_MODE === 'shared';
}

/** Local UI preview only; never enabled in a built or deployed app. */
export function isLocalFeedbackPreview(): boolean {
  return import.meta.env.DEV && isHarvestSharedSessionMode() && import.meta.env.VITE_FEEDBACK_LOCAL_PREVIEW === 'true';
}
