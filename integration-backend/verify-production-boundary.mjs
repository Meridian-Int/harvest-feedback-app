import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { synthSettings } from './synth-settings.mjs';

/** Compare public Feedback inputs with HARVEST's deployed production resources. */
export function verifyProductionBoundary(settings, identity, stack, resources, subnets) {
  if (settings.target !== 'production' || identity?.Account !== '938463256739' ||
      stack?.StackName !== 'harvest-refresh-backend-production' ||
      !['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(stack.StackStatus)) throw new Error('HARVEST production stack is not verified.');
  const outputs = Object.fromEntries((stack.Outputs ?? []).map(item => [item.OutputKey, item.OutputValue]));
  const physical = Object.fromEntries((resources.StackResourceSummaries ?? []).map(item => [item.LogicalResourceId, item.PhysicalResourceId]));
  const expectedSubnets = [physical.SubnetA, physical.SubnetB];
  const actualSubnets = (subnets.Subnets ?? []).map(item => item.SubnetId);
  if (settings.poolId !== outputs.UserPoolId || settings.clientId !== outputs.UserPoolClientId ||
      new URL(settings.apiUrl).origin !== outputs.ApiEndpoint || settings.directoryHost !== outputs.DbEndpoint ||
      settings.vpcId !== physical.Vpc || settings.securityGroupId !== physical.LambdaSecurityGroup ||
      expectedSubnets.some(id => !settings.subnetIds.includes(id)) || settings.subnetIds.length !== 2 ||
      actualSubnets.some(id => !expectedSubnets.includes(id)) || actualSubnets.length !== 2 ||
      (subnets.Subnets ?? []).some(item => settings.availabilityZones[settings.subnetIds.indexOf(item.SubnetId)] !== item.AvailabilityZone)) {
    throw new Error('Feedback production settings do not match live HARVEST production resources.');
  }
  return { target: 'production', verified: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const settings = synthSettings('.env.integration.local', process.env, 'production');
  const aws = args => JSON.parse(execFileSync(process.env.AWS_CLI_PATH || 'aws', [...args, '--region', 'us-east-2', '--output', 'json'], { encoding: 'utf8' }));
  const identity = aws(['sts', 'get-caller-identity']);
  const stack = aws(['cloudformation', 'describe-stacks', '--stack-name', 'harvest-refresh-backend-production']).Stacks?.[0];
  const resources = aws(['cloudformation', 'list-stack-resources', '--stack-name', 'harvest-refresh-backend-production']);
  const subnets = aws(['ec2', 'describe-subnets', '--subnet-ids', ...settings.subnetIds]);
  console.log(JSON.stringify(verifyProductionBoundary(settings, identity, stack, resources, subnets)));
}
