import { Amplify, type ResourcesConfig } from 'aws-amplify';

// Amplify Hosting writes this file for each branch before the Vite build.
// Local builds remain possible before a sandbox has been created.
const outputs = import.meta.glob('../../amplify_outputs.json', { eager: true, import: 'default' });
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID;
const harvestStaging = import.meta.env.VITE_HARVEST_AUTH_MODE === 'staging';
// Auth can connect to an existing Cognito pool without deploying an Amplify
// sandbox (which also provisions Data and Storage in this foundation).
const authOnly: ResourcesConfig | undefined = userPoolId && userPoolClientId ? {
  Auth: { Cognito: { userPoolId, userPoolClientId, loginWith: { email: true } } },
} : undefined;
const generated = Object.values(outputs)[0] as ResourcesConfig | undefined;
const identityPoolId = generated?.Auth?.Cognito && 'identityPoolId' in generated.Auth.Cognito
  ? generated.Auth.Cognito.identityPoolId : undefined;
// HARVEST sign-in still uses Feedback's own Data and Storage resources. Fail
// closed if any staging value is missing instead of falling back to the old pool.
const config: ResourcesConfig | undefined = harvestStaging
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
