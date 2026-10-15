import { readFileSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseSettings } from './release-settings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const settings = releaseSettings(JSON.parse(readFileSync(process.argv[2] ?? '.integration-outputs.json', 'utf8')));
// This prepares files only. Deployment is a separate reviewed action.
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--', '--mode', 'integration'], {
  cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env: {
    ...process.env, VITE_HARVEST_AUTH_MODE: 'shared', VITE_FEEDBACK_LOCAL_PREVIEW: 'false',
    VITE_COGNITO_USER_POOL_ID: settings.UserPoolId, VITE_COGNITO_USER_POOL_CLIENT_ID: settings.UserPoolClientId,
    VITE_FEEDBACK_GRAPHQL_URL: settings.GraphqlUrl,
  },
});
const output = path.join(root, '.integration-release');
mkdirSync(output, { recursive: true });
cpSync(path.join(root, 'dist'), path.join(output, 'site'), { recursive: true });
writeFileSync(path.join(output, 'prestaging-settings.json'), JSON.stringify({
  VITE_FEEDBACK_GRAPHQL_URL: settings.GraphqlUrl, FEEDBACK_SITE_ORIGIN: settings.FeedbackSiteOrigin,
  uiBucket: settings.UiBucket, distributionId: settings.DistributionId,
}, null, 2));
console.log(`Prepared shared-session site and public prestaging settings in ${output}. Nothing uploaded.`);
