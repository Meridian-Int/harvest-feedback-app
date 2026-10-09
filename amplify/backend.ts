import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { sentryIssues } from './functions/sentry-issues/resource';

const backend = defineBackend({ auth, data, storage, sentryIssues });

const { cfnUserPool, cfnUserPoolClient, cfnIdentityPool } = backend.auth.resources.cfnResources;

// Email OTP requires Cognito Essentials. Keep the app client on the OTP flow only.
cfnUserPool.userPoolTier = 'ESSENTIALS';
cfnUserPool.adminCreateUserConfig = { allowAdminCreateUserOnly: true };
cfnUserPool.addPropertyOverride('Policies.SignInPolicy.AllowedFirstAuthFactors', ['EMAIL_OTP']);
cfnUserPoolClient.explicitAuthFlows = ['ALLOW_USER_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'];
cfnIdentityPool.allowUnauthenticatedIdentities = false;
