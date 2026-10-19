import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CloudFormationClient, GetTemplateCommand } from '@aws-sdk/client-cloudformation';

const stackName = 'harvest-feedback-integration-dev';
const workerId = 'LinearIssueWorker297D8DB3';
const assetBucket = 'cdk-hnb659fds-assets-938463256739-us-east-2';
const priorAsset = '39339d9c14ea7bafb48066a0dcaa603e25d4503db6ebae1f6b214647e08ca67c.zip';
const reviewedAsset = 'b5a92105a43f169f83d2de979f33f9f1f196f4a1c0f4c97eee55a04b02313d25.zip';
const canonical = value => JSON.stringify(value, (_key, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

/** This follow-up release changes only the dev Linear worker's reviewed code bundle. */
export function verifyAssigneeDeployScope(live, proposed) {
  const oldWorker = live.Resources?.[workerId];
  const newWorker = proposed.Resources?.[workerId];
  assert.equal(oldWorker?.Type, 'AWS::Lambda::Function');
  assert.equal(newWorker?.Type, 'AWS::Lambda::Function');
  assert.deepEqual(oldWorker.Properties.Code, { S3Bucket: assetBucket, S3Key: priorAsset });
  assert.deepEqual(newWorker.Properties.Code, { S3Bucket: assetBucket, S3Key: reviewedAsset });
  const restored = structuredClone(proposed);
  restored.Resources[workerId].Properties.Code = oldWorker.Properties.Code;
  assert.equal(canonical(restored), canonical(live), 'Unreviewed Feedback dev stack change.');
  return workerId;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/verify-assignee-deploy-scope.mjs')) {
  assert.equal(process.env.FEEDBACK_TARGET, 'dev');
  const proposed = JSON.parse(readFileSync(`cdk.out/${stackName}.template.json`, 'utf8'));
  const response = await new CloudFormationClient({ region: 'us-east-2' }).send(new GetTemplateCommand({ StackName: stackName }));
  assert.ok(response.TemplateBody);
  const live = typeof response.TemplateBody === 'string' ? JSON.parse(response.TemplateBody) : response.TemplateBody;
  console.log(`Reviewed Feedback dev scope: ${verifyAssigneeDeployScope(live, proposed)} code only.`);
}
