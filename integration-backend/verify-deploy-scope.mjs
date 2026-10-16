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
const permitted = {
  [notification.queue]: { change: 'add', type: 'AWS::SQS::Queue' },
  [notification.role]: { change: 'add', type: 'AWS::IAM::Role' },
  [notification.policy]: { change: 'add', type: 'AWS::IAM::Policy' },
  [notification.worker]: { change: 'add', type: 'AWS::Lambda::Function' },
  [notification.stream]: { change: 'add', type: 'AWS::Lambda::EventSourceMapping' },
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

/** Refuse any stack drift or release outside the reviewed notification bridge. */
export function verifyDeployScope(live, proposed) {
  const liveOther = { ...live }, proposedOther = { ...proposed };
  delete liveOther.Resources; delete proposedOther.Resources;
  const priorOutputs = liveOther.Outputs ?? {}, nextOutputs = proposedOther.Outputs ?? {};
  delete liveOther.Outputs; delete proposedOther.Outputs;
  assert.equal(canonical(proposedOther), canonical(liveOther), 'Stack parameters, outputs or metadata changed.');
  for (const [key, value] of Object.entries(priorOutputs)) same(nextOutputs[key], value, `Existing stack output changed: ${key}`);
  const addedOutputs = Object.keys(nextOutputs).filter(key => !(key in priorOutputs));
  same(addedOutputs, 'HarvestNotificationFailureQueue' in priorOutputs ? [] : ['HarvestNotificationFailureQueue'], 'Unreviewed stack output added.');
  same(nextOutputs.HarvestNotificationFailureQueue, { Value: ref(notification.queue) }, 'Feedback notification failure queue output changed.');
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
