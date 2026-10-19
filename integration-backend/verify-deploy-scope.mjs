import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CloudFormationClient, GetTemplateCommand } from '@aws-sdk/client-cloudformation';

const stackName = 'harvest-feedback-integration-dev';
const notification = {
  queue: 'FailedHarvestNotification59AD0969',
  role: 'HarvestNotificationWorkerServiceRoleF8401FC0',
  policy: 'HarvestNotificationWorkerServiceRoleDefaultPolicy36A3BF2C',
  worker: 'HarvestNotificationWorker87D0308D',
  stream: 'HarvestNotificationWorkerDynamoDBEventSourceharvestfeedbackintegrationdevReports7C1D64C9E72FF23B',
};
const linear = {
  query: 'ApiQuerylinearTeamsDB29F719',
  queue: 'FailedLinearIssueDC45CADE',
  role: 'LinearIssueWorkerServiceRole3900A30E',
  policy: 'LinearIssueWorkerServiceRoleDefaultPolicyA39372F4',
  worker: 'LinearIssueWorker297D8DB3',
  stream: 'LinearIssueWorkerDynamoDBEventSourceharvestfeedbackintegrationdevReports7C1D64C9AEBA1257',
};
const linearSecretName = 'harvest-feedback/integration/dev/linear-token';
// Release-specific bundle fingerprints. A code change requires a fresh scope review.
const reviewedAssets = {
  resolver: '927601b3b9b7e342d68ceb2d9d5c0cf665aa67f456804da12df8209503343b0a.zip',
  linearWorker: '39339d9c14ea7bafb48066a0dcaa603e25d4503db6ebae1f6b214647e08ca67c.zip',
};
const linearSecretGrant = {
  Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'], Effect: 'Allow',
  Resource: { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, `:secretsmanager:us-east-2:938463256739:secret:${linearSecretName}-??????`]] },
};
const permitted = {
  [notification.queue]: { change: 'add', type: 'AWS::SQS::Queue' },
  [notification.role]: { change: 'add', type: 'AWS::IAM::Role' },
  [notification.policy]: { change: 'add', type: 'AWS::IAM::Policy' },
  [notification.worker]: { change: 'add', type: 'AWS::Lambda::Function' },
  [notification.stream]: { change: 'add', type: 'AWS::Lambda::EventSourceMapping' },
  ResolverServiceRoleDefaultPolicy2280CADF: { change: 'update', type: 'AWS::IAM::Policy' },
  ResolverE74F069E: { change: 'update', type: 'AWS::Lambda::Function' },
  ApiSchema510EECD7: { change: 'update', type: 'AWS::AppSync::GraphQLSchema' },
  [linear.query]: { change: 'add', type: 'AWS::AppSync::Resolver' },
  [linear.queue]: { change: 'add', type: 'AWS::SQS::Queue' },
  [linear.role]: { change: 'add', type: 'AWS::IAM::Role' },
  [linear.policy]: { change: 'add', type: 'AWS::IAM::Policy' },
  [linear.worker]: { change: 'add', type: 'AWS::Lambda::Function' },
  [linear.stream]: { change: 'add', type: 'AWS::Lambda::EventSourceMapping' },
};
const canonical = value => JSON.stringify(value, (_key, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const ref = id => ({ Ref: id });
const getAtt = (id, attribute) => ({ 'Fn::GetAtt': [id, attribute] });
const same = (actual, expected, message) => assert.equal(canonical(actual), canonical(expected), message);

function verifyNotificationResource(id, resource) {
  const p = resource.Properties;
  if (id === notification.queue) same(p, { MessageRetentionPeriod: 1209600 }, 'Feedback notification queue changed.');
  if (id === notification.role) same(p, {
    AssumeRolePolicyDocument: { Statement: [{ Action: 'sts:AssumeRole', Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' } }], Version: '2012-10-17' },
    ManagedPolicyArns: [{ 'Fn::Join': ['', ['arn:', ref('AWS::Partition'), ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']] }],
  }, 'Feedback notification role changed.');
  if (id === notification.policy) same(p, {
    PolicyDocument: { Statement: [
      { Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'], Effect: 'Allow', Resource: { 'Fn::Join': ['', ['arn:', ref('AWS::Partition'), ':secretsmanager:us-east-2:938463256739:secret:harvest-refresh/staging/feedback-notifications-??????']] } },
      { Action: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'], Effect: 'Allow', Resource: getAtt(notification.queue, 'Arn') },
      { Action: 'dynamodb:ListStreams', Effect: 'Allow', Resource: '*' },
      { Action: ['dynamodb:DescribeStream', 'dynamodb:GetRecords', 'dynamodb:GetShardIterator'], Effect: 'Allow', Resource: getAtt('Reports65402A0A', 'StreamArn') },
    ], Version: '2012-10-17' },
    PolicyName: notification.policy,
    Roles: [ref(notification.role)],
  }, 'Feedback notification permissions changed.');
  if (id === notification.worker) {
    assert.equal(p.Code?.S3Bucket, 'cdk-hnb659fds-assets-938463256739-us-east-2');
    assert.match(p.Code?.S3Key ?? '', /^[0-9a-f]{64}\.zip$/);
    const { Code: _code, ...withoutCode } = p;
    same(withoutCode, {
      Environment: { Variables: {
        HARVEST_API_BASE_URL: 'https://hjyuhqzj1i.execute-api.us-east-2.amazonaws.com',
        HARVEST_NOTIFICATION_SECRET_NAME: 'harvest-refresh/staging/feedback-notifications',
      } },
      Handler: 'index.handler', MemorySize: 256, Role: getAtt(notification.role, 'Arn'), Runtime: 'nodejs22.x', Timeout: 30,
    }, 'Feedback notification worker changed.');
  }
  if (id === notification.stream) same(p, {
    BatchSize: 10,
    DestinationConfig: { OnFailure: { Destination: getAtt(notification.queue, 'Arn') } },
    EventSourceArn: getAtt('Reports65402A0A', 'StreamArn'),
    FunctionName: ref(notification.worker), FunctionResponseTypes: ['ReportBatchItemFailures'],
    MaximumRetryAttempts: 10, StartingPosition: 'LATEST',
  }, 'Feedback notification stream changed.');
}

function verifyLinearResource(id, before, after, proposed) {
  const p = after.Properties;
  if (id === 'ResolverServiceRoleDefaultPolicy2280CADF') {
    const oldStatements = before.Properties.PolicyDocument.Statement;
    const nextStatements = p.PolicyDocument.Statement;
    same(nextStatements[2], linearSecretGrant, 'Linear resolver secret grant changed.');
    same({ ...after, Properties: { ...p, PolicyDocument: { ...p.PolicyDocument, Statement: nextStatements.filter((_, index) => index !== 2) } } }, before, 'Other resolver permissions changed.');
  }
  if (id === 'ResolverE74F069E') {
    same(p.Environment?.Variables?.LINEAR_TOKEN_SECRET_NAME, linearSecretName, 'Linear resolver secret changed.');
    assert.equal(p.Code?.S3Bucket, 'cdk-hnb659fds-assets-938463256739-us-east-2');
    assert.equal(p.Code?.S3Key, reviewedAssets.resolver, 'Unreviewed resolver code asset.');
    const variables = { ...p.Environment.Variables };
    delete variables.LINEAR_TOKEN_SECRET_NAME;
    same({ ...after, Properties: { ...p, Code: before.Properties.Code, Environment: { Variables: variables } } }, before, 'Other resolver settings changed.');
  }
  if (id === 'ApiSchema510EECD7') {
    const normalize = value => value.replace(/\r\n/g, '\n');
    const oldDefinition = normalize(before.Properties.Definition);
    // The older dev snapshot predates multi-file reports; the current dev
    // stack already has them. Never accept their removal from a live stack.
    const attachmentAdditions = [
      'type FeedbackAttachment { attachmentKey: String!, attachmentName: String!, attachmentType: String!, attachmentSize: Int! }\n',
      '  attachments: [FeedbackAttachment!],\n',
      'attachmentKeys: [String!], ',
    ];
    const withoutNewAttachments = attachmentAdditions.reduce((definition, addition) => oldDefinition.includes(addition) ? definition : definition.replace(addition, ''), normalize(p.Definition));
    const newDefinition = withoutNewAttachments
      .replace('  linearTeamId: String, linearIssueId: String, linearIssueIdentifier: String, linearIssueUrl: String, linearSyncStatus: String,\n', '')
      .replace('input UpdateFeedbackInput { id: ID!, status: Status, assignee: String, linearTeamId: String, updateRequestedAt:', 'input UpdateFeedbackInput { id: ID!, status: Status, assignee: String, updateRequestedAt:')
      .replace('type LinearTeam { id: String!, name: String!, key: String! }\ntype LinearTeamsResult { configured: Boolean!, teams: [LinearTeam!]! }\n', '')
      .replace('  linearTeams: LinearTeamsResult!\n', '');
    same(newDefinition, oldDefinition, 'Unreviewed GraphQL schema change.');
    same({ ...after, Properties: { ...p, Definition: before.Properties.Definition } }, before, 'Other GraphQL schema settings changed.');
  }
  if (id === linear.query) same(after, {
    ...proposed.Resources.ApiQueryfeedbackAdministratorsB4A28AF4,
    Properties: { ...proposed.Resources.ApiQueryfeedbackAdministratorsB4A28AF4.Properties, FieldName: 'linearTeams' },
  }, 'Linear team query resolver changed.');
  if (id === linear.queue) same(after, { Type: 'AWS::SQS::Queue', Properties: { MessageRetentionPeriod: 1209600 }, UpdateReplacePolicy: 'Delete', DeletionPolicy: 'Delete' }, 'Linear failure queue changed.');
  if (id === linear.role) same(after, { Type: 'AWS::IAM::Role', Properties: {
    AssumeRolePolicyDocument: { Statement: [{ Action: 'sts:AssumeRole', Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' } }], Version: '2012-10-17' },
    ManagedPolicyArns: [{ 'Fn::Join': ['', ['arn:', ref('AWS::Partition'), ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']] }],
  } }, 'Linear worker role changed.');
  if (id === linear.policy) same(after, { Type: 'AWS::IAM::Policy', Properties: {
    PolicyDocument: { Statement: [
      { Action: ['dynamodb:BatchGetItem', 'dynamodb:Query', 'dynamodb:GetItem', 'dynamodb:Scan', 'dynamodb:ConditionCheckItem', 'dynamodb:BatchWriteItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:DescribeTable'], Effect: 'Allow', Resource: [getAtt('Reports65402A0A', 'Arn'), { 'Fn::Join': ['', [getAtt('Reports65402A0A', 'Arn'), '/index/*']] }] },
      { Action: ['dynamodb:GetRecords', 'dynamodb:GetShardIterator'], Effect: 'Allow', Resource: [getAtt('Reports65402A0A', 'Arn'), { 'Fn::Join': ['', [getAtt('Reports65402A0A', 'Arn'), '/index/*']] }] },
      { Action: 'dynamodb:GetItem', Effect: 'Allow', Resource: getAtt('Attachments87B238D3', 'Arn') },
      { Action: 's3:GetObjectVersion', Effect: 'Allow', Resource: { 'Fn::Join': ['', [getAtt('MediaA721A567', 'Arn'), '/feedback-media/*']] } },
      linearSecretGrant,
      { Action: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'], Effect: 'Allow', Resource: getAtt(linear.queue, 'Arn') },
      { Action: 'dynamodb:ListStreams', Effect: 'Allow', Resource: '*' },
      { Action: ['dynamodb:DescribeStream', 'dynamodb:GetRecords', 'dynamodb:GetShardIterator'], Effect: 'Allow', Resource: getAtt('Reports65402A0A', 'StreamArn') },
    ], Version: '2012-10-17' },
    PolicyName: linear.policy, Roles: [ref(linear.role)],
  } }, 'Linear worker permissions changed.');
  if (id === linear.worker) {
    assert.equal(p.Code?.S3Bucket, 'cdk-hnb659fds-assets-938463256739-us-east-2');
    assert.equal(p.Code?.S3Key, reviewedAssets.linearWorker, 'Unreviewed Linear worker code asset.');
    const { Code: _code, ...withoutCode } = p;
    same({ ...after, Properties: withoutCode }, { Type: 'AWS::Lambda::Function', Properties: {
      Environment: { Variables: { REPORTS_TABLE: ref('Reports65402A0A'), ATTACHMENTS_TABLE: ref('Attachments87B238D3'), MEDIA_BUCKET: ref('MediaA721A567'), LINEAR_TOKEN_SECRET_NAME: linearSecretName, APP_BASE_URL: 'https://harvest-refresh-prestaging-meridian.netlify.app/feedback' } },
      Handler: 'index.handler', MemorySize: 512, Role: getAtt(linear.role, 'Arn'), Runtime: 'nodejs22.x', Timeout: 900,
    }, DependsOn: [linear.policy, linear.role] }, 'Linear worker configuration changed.');
  }
  if (id === linear.stream) same(after, { Type: 'AWS::Lambda::EventSourceMapping', Properties: {
    BatchSize: 1, DestinationConfig: { OnFailure: { Destination: getAtt(linear.queue, 'Arn') } },
    EventSourceArn: getAtt('Reports65402A0A', 'StreamArn'), FunctionName: ref(linear.worker),
    FunctionResponseTypes: ['ReportBatchItemFailures'], MaximumRetryAttempts: 10, StartingPosition: 'LATEST',
  } }, 'Linear stream changed.');
}

/** Refuse any stack drift or release outside the reviewed notification and Linear bridge. */
export function verifyDeployScope(live, proposed) {
  const liveOther = { ...live }, proposedOther = { ...proposed };
  delete liveOther.Resources; delete proposedOther.Resources;
  const priorOutputs = liveOther.Outputs ?? {}, nextOutputs = proposedOther.Outputs ?? {};
  delete liveOther.Outputs; delete proposedOther.Outputs;
  assert.equal(canonical(proposedOther), canonical(liveOther), 'Stack parameters, outputs or metadata changed.');
  for (const [key, value] of Object.entries(priorOutputs)) same(nextOutputs[key], value, `Existing stack output changed: ${key}`);
  const addedOutputs = Object.keys(nextOutputs).filter(key => !(key in priorOutputs));
  assert.ok(addedOutputs.every(key => ['HarvestNotificationFailureQueue', 'LinearFailureQueue'].includes(key)), 'Unreviewed stack output added.');
  if (nextOutputs.HarvestNotificationFailureQueue) same(nextOutputs.HarvestNotificationFailureQueue, { Value: ref(notification.queue) }, 'Feedback notification failure queue output changed.');
  if (nextOutputs.LinearFailureQueue) same(nextOutputs.LinearFailureQueue, { Value: ref(linear.queue) }, 'Linear failure queue output changed.');
  const oldResources = live.Resources ?? {}, newResources = proposed.Resources ?? {};
  const changed = [];
  for (const id of new Set([...Object.keys(oldResources), ...Object.keys(newResources)])) {
    const before = oldResources[id], after = newResources[id];
    if (canonical(before) === canonical(after)) continue;
    const rule = permitted[id];
    assert.ok(rule, `Unreviewed CloudFormation resource change: ${id}`);
    assert.ok(after && after.Type === rule.type, `Unexpected resource type: ${id}`);
    assert.ok(rule.change === (before ? 'update' : 'add'), `Unexpected resource operation: ${id}`);
    if (Object.values(notification).includes(id)) verifyNotificationResource(id, after);
    else verifyLinearResource(id, before, after, proposed);
    changed.push(id);
  }
  return changed.sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.env.FEEDBACK_TARGET, 'dev', 'Only Feedback dev can pass this deployment gate.');
  const proposed = JSON.parse(readFileSync(path.join('cdk.out', `${stackName}.template.json`), 'utf8'));
  const resolver = proposed.Resources.ResolverE74F069E.Properties.Environment.Variables;
  const arn = resolver.SENTRY_TOKEN_SECRET_ARN;
  assert.ok(/^arn:aws:secretsmanager:us-east-2:938463256739:secret:harvest-feedback\/dev\/sentry-issues-read-token-[A-Za-z0-9]{6}$/.test(arn ?? ''), 'The approved Feedback dev Sentry secret is required.');
  assert.equal(resolver.GA4_PROPERTY_ID, '558205575');
  assert.equal(proposed.Resources.ApiQuerytrafficInsights9240190F.Properties.FieldName, 'trafficInsights');
  const result = await new CloudFormationClient({ region: 'us-east-2' }).send(new GetTemplateCommand({ StackName: stackName }));
  assert.ok(result.TemplateBody, 'The deployed Feedback dev template is required.');
  const live = typeof result.TemplateBody === 'string' ? JSON.parse(result.TemplateBody) : result.TemplateBody;
  const changed = verifyDeployScope(live, proposed);
  console.log(`Reviewed Feedback dev scope: ${changed.length ? changed.join(', ') : 'no backend changes'}.`);
}
