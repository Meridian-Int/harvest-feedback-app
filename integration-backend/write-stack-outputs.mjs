import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseSettings } from './release-settings.mjs';

const target = process.env.FEEDBACK_TARGET ?? 'dev';
if (!['dev', 'test', 'production'].includes(target)) throw new Error('Unsupported Feedback target.');
const stackName = `harvest-feedback-integration-${target}`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const aws = process.env.AWS_CLI_PATH || 'aws';
  const response = JSON.parse(execFileSync(aws, ['cloudformation', 'describe-stacks', '--stack-name', stackName, '--region', 'us-east-2', '--output', 'json'], { encoding: 'utf8' }));
  const stack = response.Stacks?.[0];
  assert.ok(['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(stack?.StackStatus), 'Feedback stack must be complete.');
  const outputs = Object.fromEntries((stack.Outputs ?? []).map(output => [output.OutputKey, output.OutputValue]));
  releaseSettings({ [stackName]: outputs }, target);
  writeFileSync(`.integration-outputs-${target}.json`, JSON.stringify({ [stackName]: outputs }, null, 2));
  console.log(`Saved verified public Feedback ${target} stack outputs for the UI build.`);
}
