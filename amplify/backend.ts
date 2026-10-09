import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { sentryIssues } from './functions/sentry-issues/resource';
import { verifyAttachment } from './functions/verify-attachment/resource';

const backend = defineBackend({ auth, data, storage, sentryIssues, verifyAttachment });

const validator = backend.verifyAttachment;
validator.addEnvironment('IDENTITY_POOL_ID', backend.auth.resources.identityPoolId);
validator.addEnvironment('USER_POOL_PROVIDER', `cognito-idp.${backend.auth.resources.userPool.stack.region}.amazonaws.com/${backend.auth.resources.userPool.userPoolId}`);
validator.addEnvironment('MEDIA_BUCKET', backend.storage.resources.bucket.bucketName);
backend.storage.resources.bucket.grantRead(validator.resources.lambda, 'feedback-media/*');
backend.data.resources.graphqlApi.addLambdaDataSource('VerifyAttachment', validator.resources.lambda);

const { cfnUserPool, cfnUserPoolClient, cfnIdentityPool } = backend.auth.resources.cfnResources;

// Cognito Essentials supports email OTP and optional password sign-in.
cfnUserPool.userPoolTier = 'ESSENTIALS';
cfnUserPool.adminCreateUserConfig = { allowAdminCreateUserOnly: true };
// USER_AUTH offers email OTP by default and PASSWORD after a client sets one.
cfnUserPool.addPropertyOverride('Policies.SignInPolicy.AllowedFirstAuthFactors', ['PASSWORD', 'EMAIL_OTP']);
cfnUserPoolClient.explicitAuthFlows = ['ALLOW_USER_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'];
cfnIdentityPool.allowUnauthenticatedIdentities = false;
