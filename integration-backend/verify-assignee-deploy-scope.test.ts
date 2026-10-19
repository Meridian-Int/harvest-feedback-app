import { expect, it } from 'vitest';
// @ts-expect-error The deployment gate is plain Node ESM.
import { verifyAssigneeDeployScope } from './verify-assignee-deploy-scope.mjs';

const workerId = 'LinearIssueWorker297D8DB3';
const bucket = 'cdk-hnb659fds-assets-938463256739-us-east-2';
const oldKey = '39339d9c14ea7bafb48066a0dcaa603e25d4503db6ebae1f6b214647e08ca67c.zip';
const newKey = 'b5a92105a43f169f83d2de979f33f9f1f196f4a1c0f4c97eee55a04b02313d25.zip';
const live = { Resources: { [workerId]: { Type: 'AWS::Lambda::Function', Properties: { Code: { S3Bucket: bucket, S3Key: oldKey }, Environment: { Variables: { REPORTS_TABLE: 'dev-reports' } } } }, Other: { Type: 'AWS::S3::Bucket' } }, Outputs: { Api: 'dev' } };

it('allows only the reviewed dev Linear worker bundle', () => {
  const next = structuredClone(live);
  next.Resources[workerId].Properties.Code.S3Key = newKey;
  expect(verifyAssigneeDeployScope(live, next)).toBe(workerId);
  next.Resources[workerId].Properties.Environment.Variables.REPORTS_TABLE = 'production-reports';
  expect(() => verifyAssigneeDeployScope(live, next)).toThrow('Unreviewed Feedback dev stack change');
});

it('rejects another bundle or any unrelated resource change', () => {
  const next = structuredClone(live);
  next.Resources[workerId].Properties.Code.S3Key = 'unreviewed.zip';
  expect(() => verifyAssigneeDeployScope(live, next)).toThrow();
  next.Resources[workerId].Properties.Code.S3Key = newKey;
  next.Outputs.Api = 'production';
  expect(() => verifyAssigneeDeployScope(live, next)).toThrow('Unreviewed Feedback dev stack change');
});
