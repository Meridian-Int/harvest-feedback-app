import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { sentryIssues } from './functions/sentry-issues/resource';
import { verifyAttachment } from './functions/verify-attachment/resource';
import { notifyAdmin } from './functions/notify-admin/resource';
import { PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { CfnResource, Stack } from 'aws-cdk-lib';

const backend = defineBackend({ auth, data, storage, sentryIssues, verifyAttachment, notifyAdmin });

// Keep the shared sandbox's report table easy to identify in DynamoDB. Amplify
// does not expose a table-name setter, so update its generated custom resource.
// A new logical ID makes CloudFormation create the named table on this migration.
const feedbackTable = backend.data.resources.cfnResources.amplifyDynamoDbTables.Feedback as unknown as {
  resource: CfnResource;
};
if (
  feedbackTable.resource.node.tryGetContext('amplify-backend-type') === 'sandbox' &&
  feedbackTable.resource.node.tryGetContext('amplify-backend-name') === 'sahil-feedback'
) {
  const tableName = 'harvest-feedback-dev-reports';
  const roleNames = ['AmplifyManagedTableOnEventRole', 'AmplifyManagedTableIsCompleteRole'];
  const managerRoles = feedbackTable.resource.node.root.node.findAll().filter(
    (construct): construct is Role => construct instanceof Role && roleNames.includes(construct.node.id),
  );
  if (managerRoles.length !== roleNames.length) {
    throw new Error('Could not locate both Amplify table manager roles for the named Feedback table');
  }
  for (const role of managerRoles) {
    role.addToPrincipalPolicy(new PolicyStatement({
      actions: [
        'dynamodb:CreateTable', 'dynamodb:UpdateTable', 'dynamodb:DeleteTable',
        'dynamodb:DescribeTable', 'dynamodb:DescribeContinuousBackups',
        'dynamodb:DescribeTimeToLive', 'dynamodb:UpdateContinuousBackups',
        'dynamodb:UpdateTimeToLive', 'dynamodb:TagResource',
        'dynamodb:UntagResource', 'dynamodb:ListTagsOfResource',
      ],
      resources: [Stack.of(role).formatArn({ service: 'dynamodb', resource: 'table', resourceName: tableName })],
    }));
  }
  const apiRole = feedbackTable.resource.node.root.node.findAll().find(
    (construct): construct is Role => construct instanceof Role && construct.node.id === 'FeedbackIAMRole',
  );
  if (!apiRole) {
    throw new Error('Could not locate the Feedback AppSync role for the named table');
  }
  const tableArn = Stack.of(apiRole).formatArn({ service: 'dynamodb', resource: 'table', resourceName: tableName });
  apiRole.addToPrincipalPolicy(new PolicyStatement({
    actions: [
      'dynamodb:BatchGetItem', 'dynamodb:BatchWriteItem', 'dynamodb:PutItem',
      'dynamodb:DeleteItem', 'dynamodb:GetItem', 'dynamodb:Scan',
      'dynamodb:Query', 'dynamodb:UpdateItem', 'dynamodb:ConditionCheckItem',
      'dynamodb:DescribeTable', 'dynamodb:GetRecords', 'dynamodb:GetShardIterator',
    ],
    resources: [tableArn, `${tableArn}/*`],
  }));
  feedbackTable.resource.addPropertyOverride('tableName', tableName);
  feedbackTable.resource.overrideLogicalId('FeedbackTableNamed');
}

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

// The existing shared sandbox has a readable pool name. Cognito rejects an
// otherwise unchanged schema when CloudFormation updates this pool, so omit
// Schema from updates to this existing pool only. New pools retain the schema.
if (
  cfnUserPool.node.tryGetContext('amplify-backend-type') === 'sandbox' &&
  cfnUserPool.node.tryGetContext('amplify-backend-name') === 'sahil-feedback'
) {
  cfnUserPool.userPoolName = 'harvest-feedback-dev-users';
  cfnUserPool.addPropertyDeletionOverride('Schema');
}

// Cognito Essentials supports email OTP and optional password sign-in.
cfnUserPool.userPoolTier = 'ESSENTIALS';
cfnUserPool.adminCreateUserConfig = { allowAdminCreateUserOnly: true };
// USER_AUTH offers email OTP by default and PASSWORD after a client sets one.
cfnUserPool.addPropertyOverride('Policies.SignInPolicy.AllowedFirstAuthFactors', ['PASSWORD', 'EMAIL_OTP']);
cfnUserPoolClient.explicitAuthFlows = ['ALLOW_USER_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'];
cfnIdentityPool.allowUnauthenticatedIdentities = false;
