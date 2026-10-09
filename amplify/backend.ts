import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { sentryIssues } from './functions/sentry-issues/resource';
import { verifyAttachment } from './functions/verify-attachment/resource';
import { notifyAdmin } from './functions/notify-admin/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({ auth, data, storage, sentryIssues, verifyAttachment, notifyAdmin });

const notifier = backend.notifyAdmin;
notifier.addEnvironment('USER_POOL_ID', backend.auth.resources.userPool.userPoolId);
backend.data.resources.graphqlApi.addLambdaDataSource('NotifyAdmin', notifier.resources.lambda);
notifier.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['cognito-idp:ListUsersInGroup'],
  resources: [backend.auth.resources.userPool.userPoolArn],
}));
if (process.env.ADMIN_NOTIFICATION_FROM_EMAIL) {
  notifier.resources.lambda.addToRolePolicy(new PolicyStatement({
    actions: ['ses:SendEmail'],
    resources: ['*'],
    conditions: { StringEquals: { 'ses:FromAddress': process.env.ADMIN_NOTIFICATION_FROM_EMAIL } },
  }));
}

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
