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
  expect(() => verifyDeployScope(live, changed)).toThrow('Unreviewed CloudFormation resource change: ResolverE74F069E');
});

it('rejects a broader IAM grant', () => {
  const changed = proposed();
  changed.Resources.ResolverServiceRoleDefaultPolicy2280CADF.Properties.PolicyDocument.Statement.push({ Effect: 'Allow', Action: ['secretsmanager:*'], Resource: '*' });
  expect(() => verifyDeployScope(live, changed)).toThrow('Unreviewed CloudFormation resource change: ResolverServiceRoleDefaultPolicy2280CADF');
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
