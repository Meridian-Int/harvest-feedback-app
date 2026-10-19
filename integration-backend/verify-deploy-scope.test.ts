import { expect, it } from 'vitest';
// @ts-expect-error The deployment gate is plain Node ESM.
import { verifyDeployScope } from './verify-deploy-scope.mjs';

const oldEnvironment = { REPORTS_TABLE: 'feedback-reports', SENTRY_TOKEN_SECRET_ARN: 'existing-arn' };
const oldResources = {
  ResolverServiceRoleDefaultPolicy2280CADF: { Type: 'AWS::IAM::Policy', Properties: { PolicyDocument: { Statement: [] as Array<{ Effect: string; Action: string[]; Resource: string }> } } },
  ResolverE74F069E: { Type: 'AWS::Lambda::Function', Properties: { Code: 'before', Environment: { Variables: oldEnvironment }, Runtime: 'nodejs22.x' } },
  ApiSchema510EECD7: { Type: 'AWS::AppSync::GraphQLSchema', Properties: { Definition: 'before' } },
  ReportsTable: { Type: 'AWS::DynamoDB::Table', Properties: { TableName: 'feedback-reports' } },
};
const ids = {
  queue: 'FailedHarvestNotification59AD0969', role: 'HarvestNotificationWorkerServiceRoleF8401FC0',
  policy: 'HarvestNotificationWorkerServiceRoleDefaultPolicy36A3BF2C', worker: 'HarvestNotificationWorker87D0308D',
  stream: 'HarvestNotificationWorkerDynamoDBEventSourceharvestfeedbackintegrationdevReports7C1D64C9E72FF23B',
} as const;
const ref = (name: string) => ({ Ref: name });
const getAtt = (name: string, attribute: string) => ({ 'Fn::GetAtt': [name, attribute] });
const notificationResources = {
  [ids.queue]: { Type: 'AWS::SQS::Queue', Properties: { MessageRetentionPeriod: 1209600 } },
  [ids.role]: { Type: 'AWS::IAM::Role', Properties: { AssumeRolePolicyDocument: { Statement: [{ Action: 'sts:AssumeRole', Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' } }], Version: '2012-10-17' }, ManagedPolicyArns: [{ 'Fn::Join': ['', ['arn:', ref('AWS::Partition'), ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']] }] } },
  [ids.policy]: { Type: 'AWS::IAM::Policy', Properties: { PolicyDocument: { Statement: [
    { Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'], Effect: 'Allow', Resource: { 'Fn::Join': ['', ['arn:', ref('AWS::Partition'), ':secretsmanager:us-east-2:938463256739:secret:harvest-refresh/staging/feedback-notifications-??????']] } },
    { Action: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'], Effect: 'Allow', Resource: getAtt(ids.queue, 'Arn') },
    { Action: 'dynamodb:ListStreams', Effect: 'Allow', Resource: '*' },
    { Action: ['dynamodb:DescribeStream', 'dynamodb:GetRecords', 'dynamodb:GetShardIterator'], Effect: 'Allow', Resource: getAtt('Reports65402A0A', 'StreamArn') },
  ], Version: '2012-10-17' }, PolicyName: ids.policy, Roles: [ref(ids.role)] } },
  [ids.worker]: { Type: 'AWS::Lambda::Function', Properties: { Code: { S3Bucket: 'cdk-hnb659fds-assets-938463256739-us-east-2', S3Key: `${'a'.repeat(64)}.zip` }, Environment: { Variables: { HARVEST_API_BASE_URL: 'https://hjyuhqzj1i.execute-api.us-east-2.amazonaws.com', HARVEST_NOTIFICATION_SECRET_NAME: 'harvest-refresh/staging/feedback-notifications' } }, Handler: 'index.handler', MemorySize: 256, Role: getAtt(ids.role, 'Arn'), Runtime: 'nodejs22.x', Timeout: 30 } },
  [ids.stream]: { Type: 'AWS::Lambda::EventSourceMapping', Properties: { BatchSize: 10, DestinationConfig: { OnFailure: { Destination: getAtt(ids.queue, 'Arn') } }, EventSourceArn: getAtt('Reports65402A0A', 'StreamArn'), FunctionName: ref(ids.worker), FunctionResponseTypes: ['ReportBatchItemFailures'], MaximumRetryAttempts: 10, StartingPosition: 'LATEST' } },
};
const live = { Resources: oldResources, Outputs: { Api: 'feedback-dev' } };
const proposed = () => ({ Resources: {
  ...structuredClone(oldResources),
  ...structuredClone(notificationResources),
}, Outputs: { Api: 'feedback-dev', HarvestNotificationFailureQueue: { Value: ref(ids.queue) } } });

it('permits only the five reviewed notification resources', () => {
  expect(verifyDeployScope(live, proposed())).toEqual(['FailedHarvestNotification59AD0969', 'HarvestNotificationWorker87D0308D', 'HarvestNotificationWorkerDynamoDBEventSourceharvestfeedbackintegrationdevReports7C1D64C9E72FF23B', 'HarvestNotificationWorkerServiceRoleDefaultPolicy36A3BF2C', 'HarvestNotificationWorkerServiceRoleF8401FC0']);
});

it('rejects changes to existing report data resources', () => {
  const changed = proposed();
  changed.Resources.ReportsTable.Properties.TableName = 'different';
  expect(() => verifyDeployScope(live, changed)).toThrow('Unreviewed CloudFormation resource change: ReportsTable');
});

it('rejects changes to existing resolver settings', () => {
  const changed = proposed();
  changed.Resources.ResolverE74F069E.Properties.Environment.Variables.REPORTS_TABLE = 'other';
  expect(() => verifyDeployScope(live, changed)).toThrow('Linear resolver secret changed.');
});

it('rejects a broader IAM grant', () => {
  const changed = proposed();
  changed.Resources.ResolverServiceRoleDefaultPolicy2280CADF.Properties.PolicyDocument.Statement.push({ Effect: 'Allow', Action: ['secretsmanager:*'], Resource: '*' });
  expect(() => verifyDeployScope(live, changed)).toThrow('Linear resolver secret grant changed.');
});

it('rejects a broader notification secret grant or endpoint', () => {
  const changed = proposed();
  changed.Resources[ids.policy].Properties.PolicyDocument.Statement[0].Action = ['secretsmanager:*'];
  expect(() => verifyDeployScope(live, changed)).toThrow('Feedback notification permissions changed.');
  const other = proposed();
  other.Resources[ids.worker].Properties.Environment.Variables.HARVEST_API_BASE_URL = 'https://example.com/';
  expect(() => verifyDeployScope(live, other)).toThrow('Feedback notification worker changed.');
});

it('rejects a changed stream or unrelated output', () => {
  const changed = proposed();
  changed.Resources[ids.stream].Properties.StartingPosition = 'TRIM_HORIZON';
  expect(() => verifyDeployScope(live, changed)).toThrow('Feedback notification stream changed.');
  const other = proposed();
  (other.Outputs as Record<string, unknown>).Other = { Value: 'unreviewed' };
  expect(() => verifyDeployScope(live, other)).toThrow('Unreviewed stack output added.');
});

const linearGrant = { Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'], Effect: 'Allow', Resource: { 'Fn::Join': ['', ['arn:', ref('AWS::Partition'), ':secretsmanager:us-east-2:938463256739:secret:harvest-feedback/integration/dev/linear-token-??????']] } };
const reviewedResolverAsset = 'ffbd8b1355cc5da6311bd7f15d59efff84f9f90768e705b96e4105a94219c78a.zip';
function withReviewedLinearUpdates() {
  const prior: any = structuredClone(live);
  const next: any = proposed();
  const priorPolicy = prior.Resources.ResolverServiceRoleDefaultPolicy2280CADF.Properties.PolicyDocument;
  priorPolicy.Statement = [{ Action: ['dynamodb:GetItem'], Effect: 'Allow', Resource: 'reports' }, { Action: ['s3:GetObject'], Effect: 'Allow', Resource: 'media' }];
  next.Resources.ResolverServiceRoleDefaultPolicy2280CADF.Properties.PolicyDocument.Statement = [...priorPolicy.Statement, linearGrant];
  prior.Resources.ResolverE74F069E.Properties.Code = { S3Bucket: 'cdk-hnb659fds-assets-938463256739-us-east-2', S3Key: `${'a'.repeat(64)}.zip` };
  next.Resources.ResolverE74F069E.Properties.Code = { S3Bucket: 'cdk-hnb659fds-assets-938463256739-us-east-2', S3Key: reviewedResolverAsset };
  next.Resources.ResolverE74F069E.Properties.Environment.Variables.LINEAR_TOKEN_SECRET_NAME = 'harvest-feedback/integration/dev/linear-token';
  prior.Resources.ApiSchema510EECD7.Properties.Definition = 'type Feedback {\n  owner: String!\n}\n';
  next.Resources.ApiSchema510EECD7.Properties.Definition = 'type Feedback {\n  linearTeamId: String, linearIssueId: String, linearIssueIdentifier: String, linearIssueUrl: String, linearSyncStatus: String,\n  owner: String!\n}\n';
  return { prior, next };
}

it('permits only the reviewed existing-resource changes for Linear', () => {
  const { prior, next } = withReviewedLinearUpdates();
  expect(verifyDeployScope(prior, next)).toEqual(expect.arrayContaining([
    'ResolverServiceRoleDefaultPolicy2280CADF', 'ResolverE74F069E', 'ApiSchema510EECD7',
  ]));
});

it('permits the exact multi-file schema additions already in the Feedback proposal', () => {
  const { prior, next } = withReviewedLinearUpdates();
  prior.Resources.ApiSchema510EECD7.Properties.Definition =
    'type Feedback {\n  owner: String!\n}\ninput Submit { attachmentSize: Int, sentryIssueId: String }\n';
  next.Resources.ApiSchema510EECD7.Properties.Definition =
    'type FeedbackAttachment { attachmentKey: String!, attachmentName: String!, attachmentType: String!, attachmentSize: Int! }\n' +
    'type Feedback {\n  attachments: [FeedbackAttachment!],\n  linearTeamId: String, linearIssueId: String, linearIssueIdentifier: String, linearIssueUrl: String, linearSyncStatus: String,\n  owner: String!\n}\n' +
    'input Submit { attachmentSize: Int, attachmentKeys: [String!], sentryIssueId: String }\n';
  expect(verifyDeployScope(prior, next)).toContain('ApiSchema510EECD7');
  next.Resources.ApiSchema510EECD7.Properties.Definition = next.Resources.ApiSchema510EECD7.Properties.Definition.replace('attachmentKeys: [String!]', 'attachmentKeys: [ID!]');
  expect(() => verifyDeployScope(prior, next)).toThrow('Unreviewed GraphQL schema change.');
});

it('preserves multi-file fields when they are already deployed', () => {
  const { prior, next } = withReviewedLinearUpdates();
  const attachment = 'type FeedbackAttachment { attachmentKey: String!, attachmentName: String!, attachmentType: String!, attachmentSize: Int! }\n';
  const fields = '  attachments: [FeedbackAttachment!],\n';
  const submit = 'input Submit { attachmentKeys: [String!] }\n';
  prior.Resources.ApiSchema510EECD7.Properties.Definition = attachment + 'type Feedback {\n' + fields + '  owner: String!\n}\n' + submit;
  next.Resources.ApiSchema510EECD7.Properties.Definition = attachment + 'type Feedback {\n' + fields +
    '  linearTeamId: String, linearIssueId: String, linearIssueIdentifier: String, linearIssueUrl: String, linearSyncStatus: String,\n  owner: String!\n}\n' + submit;
  expect(verifyDeployScope(prior, next)).toContain('ApiSchema510EECD7');
  next.Resources.ApiSchema510EECD7.Properties.Definition = next.Resources.ApiSchema510EECD7.Properties.Definition.replace(fields, '');
  expect(() => verifyDeployScope(prior, next)).toThrow('Unreviewed GraphQL schema change.');
});

it('rejects unrelated resolver settings and permissions during the Linear release', () => {
  const { prior, next } = withReviewedLinearUpdates();
  next.Resources.ResolverE74F069E.Properties.Environment.Variables.REPORTS_TABLE = 'other';
  expect(() => verifyDeployScope(prior, next)).toThrow('Other resolver settings changed.');
  next.Resources.ResolverE74F069E.Properties.Environment.Variables.REPORTS_TABLE = 'feedback-reports';
  next.Resources.ResolverServiceRoleDefaultPolicy2280CADF.Properties.PolicyDocument.Statement.push({ Action: 'secretsmanager:*', Effect: 'Allow', Resource: '*' });
  expect(() => verifyDeployScope(prior, next)).toThrow('Other resolver permissions changed.');
});

it('rejects unreviewed schema and code assets', () => {
  const { prior, next } = withReviewedLinearUpdates();
  next.Resources.ApiSchema510EECD7.Properties.Definition += 'type Other { id: ID! }\n';
  expect(() => verifyDeployScope(prior, next)).toThrow('Unreviewed GraphQL schema change.');
  next.Resources.ApiSchema510EECD7.Properties.Definition = 'type Feedback {\n  linearTeamId: String, linearIssueId: String, linearIssueIdentifier: String, linearIssueUrl: String, linearSyncStatus: String,\n  owner: String!\n}\n';
  next.Resources.ResolverE74F069E.Properties.Code.S3Key = `${'b'.repeat(64)}.zip`;
  expect(() => verifyDeployScope(prior, next)).toThrow('Unreviewed resolver code asset.');
});

it('pins the combined dev media and worker updates without permitting broader changes', () => {
  const prior: any = structuredClone(live);
  const next: any = structuredClone(live);
  const origins = ['https://harvest-refresh-prestaging-meridian.netlify.app', 'http://localhost:5173'];
  const media = { Type: 'AWS::S3::Bucket', Properties: { BucketEncryption: 'unchanged', CorsConfiguration: { CorsRules: [{ AllowedHeaders: ['*'], AllowedMethods: ['PUT', 'GET', 'HEAD'], AllowedOrigins: origins, ExposedHeaders: ['ETag'], MaxAge: 60 }] } } };
  prior.Resources.MediaA721A567 = media;
  next.Resources.MediaA721A567 = structuredClone(media);
  next.Resources.MediaA721A567.Properties.CorsConfiguration.CorsRules[0].AllowedOrigins.splice(1, 0, 'https://staging.harvestbymeridian.ai', 'https://harvest-refresh-staging-meridian.netlify.app');
  const workerAssets = {
    HarvestDirectory2165E50A: '409e2d2bc418d81717576a8a38b5772797730b6f0e500a59ba4b499b32bdcd40.zip',
    EmailWorker9F0FF8B3: '9b249e08c768b08cbe2963fe220c4af8eaa6a3d66fdaaa0d9a6ff8469ed8dbea.zip',
  };
  for (const [id, asset] of Object.entries(workerAssets)) {
    prior.Resources[id] = { Type: 'AWS::Lambda::Function', Properties: { Code: { S3Bucket: 'cdk-hnb659fds-assets-938463256739-us-east-2', S3Key: `${'a'.repeat(64)}.zip` }, Runtime: 'nodejs22.x' } };
    next.Resources[id] = structuredClone(prior.Resources[id]);
    next.Resources[id].Properties.Code.S3Key = asset;
  }
  expect(verifyDeployScope(prior, next)).toEqual(['EmailWorker9F0FF8B3', 'HarvestDirectory2165E50A', 'MediaA721A567']);
  next.Resources.MediaA721A567.Properties.CorsConfiguration.CorsRules[0].AllowedOrigins.push('https://example.com');
  expect(() => verifyDeployScope(prior, next)).toThrow('Unreviewed dev media CORS.');
  next.Resources.MediaA721A567.Properties.CorsConfiguration.CorsRules[0].AllowedOrigins.pop();
  next.Resources.EmailWorker9F0FF8B3.Properties.Code.S3Key = `${'b'.repeat(64)}.zip`;
  expect(() => verifyDeployScope(prior, next)).toThrow('Unreviewed EmailWorker9F0FF8B3 code asset.');
});
