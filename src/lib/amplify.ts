import { Amplify, type ResourcesConfig } from 'aws-amplify';

// Amplify Hosting writes this file for each branch before the Vite build.
// Local builds remain possible before a sandbox has been created.
const outputs = import.meta.glob('../../amplify_outputs.json', { eager: true, import: 'default' });
const config = Object.values(outputs)[0] as ResourcesConfig | undefined;

if (config) Amplify.configure(config);

export function isAmplifyConfigured(): boolean {
  return Boolean(config);
}

export function requireAmplify(): void {
  if (!config) throw new Error('Harvest sign-in is not configured yet.');
}
