import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseSettings } from './release-settings.mjs';

const stackName = 'harvest-feedback-integration-dev';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.env.FEEDBACK_TARGET, 'dev');
  const aws = process.env.AWS_CLI_PATH || 'aws';
  const response = JSON.parse(execFileSync(aws, ['cloudformation', 'describe-stacks', '--stack-name', stackName, '--region', 'us-east-2', '--output', 'json'], { encoding: 'utf8' }));
  const stack = response.Stacks?.[0];
  assert.equal(stack?.StackStatus, 'UPDATE_COMPLETE');
  const outputs = Object.fromEntries((stack.Outputs ?? []).map(output => [output.OutputKey, output.OutputValue]));
  releaseSettings({ [stackName]: outputs });
  writeFileSync('.integration-outputs.json', JSON.stringify({ [stackName]: outputs }, null, 2));
  console.log('Saved verified public Feedback dev stack outputs for the UI build.');
}
