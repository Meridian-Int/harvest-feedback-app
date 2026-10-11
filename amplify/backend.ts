import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { sentryIssues } from './functions/sentry-issues/resource';
import { verifyAttachment } from './functions/verify-attachment/resource';
import { notifyAdmin } from './functions/notify-admin/resource';
import { feedbackEmailDelivery } from './functions/feedback-email/resource';
import { authEmail } from './functions/auth-email/resource';
import { harvestViewer } from './functions/harvest-viewer/resource';
import { harvestReportActor } from './functions/harvest-report-actor/resource';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource, SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { CfnResource, Stack } from 'aws-cdk-lib';

const backend = defineBackend({ auth, data, storage, sentryIssues, verifyAttachment, notifyAdmin, feedbackEmailDelivery, harvestViewer, harvestReportActor, ...(process.env.COGNITO_EMAIL_SOURCE_ARN ? { authEmail } : {}) });

// Enable only after sender identities, DNS and production recipients are verified.
// LATEST avoids emailing the existing demonstration reports when this is enabled.
if (process.env.FEEDBACK_EMAIL_ENABLED === 'true') {
  const reportTableDefinition = backend.data.resources.cfnResources.amplifyDynamoDbTables.Feedback as unknown as { resource: CfnResource };
  reportTableDefinition.resource.addPropertyOverride('streamSpecification', { streamViewType: 'NEW_AND_OLD_IMAGES' });
  const delivery = backend.feedbackEmailDelivery;
  delivery.addEnvironment('USER_POOL_ID', backend.auth.resources.userPool.userPoolId);
  if (process.env.HARVEST_STAGING_USER_POOL_ID) delivery.addEnvironment('HARVEST_STAGING_USER_POOL_ID', process.env.HARVEST_STAGING_USER_POOL_ID);
  const stack = backend.createStack('feedback-email-events');
  const receipts = new Table(stack, 'EmailDelivery', { partitionKey: { name: 'id', type: AttributeType.STRING }, billingMode: BillingMode.PAY_PER_REQUEST, timeToLiveAttribute: 'expiresAt' });
  const failed = new Queue(stack, 'FailedFeedbackEmail');
  delivery.addEnvironment('EMAIL_DELIVERY_TABLE', receipts.tableName);
  receipts.grantReadWriteData(delivery.resources.lambda);
  delivery.resources.lambda.addEventSource(new DynamoEventSource(backend.data.resources.tables.Feedback, {
    startingPosition: StartingPosition.LATEST, batchSize: 10, reportBatchItemFailures: true, retryAttempts: 10, onFailure: new SqsDlq(failed),
  }));
  delivery.resources.lambda.addToRolePolicy(new PolicyStatement({ actions: ['cognito-idp:ListUsersInGroup'], resources: [backend.auth.resources.userPool.userPoolArn] }));
  if (process.env.HARVEST_STAGING_USER_POOL_ID) delivery.resources.lambda.addToRolePolicy(new PolicyStatement({
    actions: ['cognito-idp:ListUsersInGroup'],
    resources: [Stack.of(delivery.resources.lambda).formatArn({ service: 'cognito-idp', resource: 'userpool', resourceName: process.env.HARVEST_STAGING_USER_POOL_ID })],
  }));
  delivery.resources.lambda.addToRolePolicy(new PolicyStatement({ actions: ['ses:SendEmail'], resources: ['*'], conditions: { StringEquals: { 'ses:FromAddress': [process.env.CLIENT_NOTIFICATION_FROM_EMAIL ?? 'sahil+feedback@withmeridian.ai', process.env.ADMIN_NOTIFICATION_FROM_EMAIL ?? 'manasa+feedback@withmeridian.ai'] } } }));
}

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
if (process.env.HARVEST_STAGING_USER_POOL_ID) notifier.addEnvironment('HARVEST_STAGING_USER_POOL_ID', process.env.HARVEST_STAGING_USER_POOL_ID);
backend.data.resources.graphqlApi.addLambdaDataSource('NotifyAdmin', notifier.resources.lambda);
notifier.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['cognito-idp:ListUsersInGroup'],
  resources: [backend.auth.resources.userPool.userPoolArn],
}));
if (process.env.HARVEST_STAGING_USER_POOL_ID) notifier.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['cognito-idp:ListUsersInGroup'],
  resources: [Stack.of(notifier.resources.lambda).formatArn({ service: 'cognito-idp', resource: 'userpool', resourceName: process.env.HARVEST_STAGING_USER_POOL_ID })],
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
if (process.env.HARVEST_STAGING_USER_POOL_ID) validator.addEnvironment('HARVEST_USER_POOL_PROVIDER', `cognito-idp.us-east-2.amazonaws.com/${process.env.HARVEST_STAGING_USER_POOL_ID}`);
validator.addEnvironment('MEDIA_BUCKET', backend.storage.resources.bucket.bucketName);
backend.storage.resources.bucket.grantRead(validator.resources.lambda, 'feedback-media/*');
backend.data.resources.graphqlApi.addLambdaDataSource('VerifyAttachment', validator.resources.lambda);

const { cfnUserPool, cfnUserPoolClient, cfnIdentityPool } = backend.auth.resources.cfnResources;
backend.harvestReportActor.addEnvironment('FEEDBACK_USER_POOL_ID', backend.auth.resources.userPool.userPoolId);
backend.data.resources.graphqlApi.addLambdaDataSource('VerifyHarvestReporter', backend.harvestReportActor.resources.lambda);

// During the dev/test transition keep the existing Feedback pool available for
// old report owners, and accept the active HARVEST staging pool as an additional
// provider. Environment configuration is deliberately absent on production.
const harvestPoolId = process.env.HARVEST_STAGING_USER_POOL_ID;
const harvestClientId = process.env.HARVEST_STAGING_APP_CLIENT_ID;
if (harvestPoolId || harvestClientId) {
  const branch = (process.env.AWS_BRANCH ?? process.env.AMPLIFY_BRANCH ?? '').toLowerCase();
  const backendName = String(cfnUserPool.node.tryGetContext('amplify-backend-name') ?? '').toLowerCase();
  const permittedStagingTarget = ['dev', 'test'].includes(branch) || ['dev', 'test', 'sahil-feedback'].includes(backendName);
  if (!harvestPoolId || !harvestClientId ||
      !/^us-east-2_[A-Za-z0-9]+$/.test(harvestPoolId) ||
      !/^[a-z0-9]+$/.test(harvestClientId) ||
      !permittedStagingTarget ||
      ['main', 'production'].includes(branch) || ['main', 'production'].includes(backendName)) {
    throw new Error('Invalid or production HARVEST staging auth configuration');
  }
  const graphqlApi = backend.data.resources.cfnResources.cfnGraphqlApi;
  const existingAuth = graphqlApi.additionalAuthenticationProviders;
  const existingIdentityProviders = cfnIdentityPool.cognitoIdentityProviders;
  if (!Array.isArray(existingAuth) || !Array.isArray(existingIdentityProviders)) {
    throw new Error('Cannot safely preserve the existing Feedback auth providers');
  }
  graphqlApi.additionalAuthenticationProviders = [...existingAuth, {
    authenticationType: 'AMAZON_COGNITO_USER_POOLS',
    userPoolConfig: {
      userPoolId: harvestPoolId,
      awsRegion: 'us-east-2',
      appIdClientRegex: `^${harvestClientId}$`,
    },
  }];
  cfnIdentityPool.cognitoIdentityProviders = [...existingIdentityProviders, {
    clientId: harvestClientId,
    providerName: `cognito-idp.us-east-2.amazonaws.com/${harvestPoolId}`,
  }];
}

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
if (process.env.COGNITO_EMAIL_SOURCE_ARN) {
  cfnUserPool.emailConfiguration = {
    emailSendingAccount: 'DEVELOPER', sourceArn: process.env.COGNITO_EMAIL_SOURCE_ARN,
    from: process.env.CLIENT_NOTIFICATION_FROM_EMAIL ?? 'sahil+feedback@withmeridian.ai',
    replyToEmailAddress: process.env.CLIENT_NOTIFICATION_FROM_EMAIL ?? 'sahil+feedback@withmeridian.ai',
  };
}
// USER_AUTH offers email OTP by default and PASSWORD after a client sets one.
cfnUserPool.addPropertyOverride('Policies.SignInPolicy.AllowedFirstAuthFactors', ['PASSWORD', 'EMAIL_OTP']);
cfnUserPoolClient.explicitAuthFlows = ['ALLOW_USER_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'];
cfnIdentityPool.allowUnauthenticatedIdentities = false;
