import { expect, it } from 'vitest';
// @ts-expect-error The AWS preflight helper is plain Node ESM.
import { verifyProductionBoundary } from './verify-production-boundary.mjs';

const settings = {
  target: 'production', poolId: 'production-pool', clientId: 'production-client', apiUrl: 'https://api.production.example/',
  directoryHost: 'harvest-refresh-production.example.us-east-2.rds.amazonaws.com', vpcId: 'vpc-prod',
  securityGroupId: 'sg-prod', subnetIds: ['subnet-a', 'subnet-b'], availabilityZones: ['us-east-2a', 'us-east-2b'],
};
const identity = { Account: '938463256739' };
const stack = { StackName: 'harvest-refresh-backend-production', StackStatus: 'UPDATE_COMPLETE', Outputs: [
  { OutputKey: 'UserPoolId', OutputValue: settings.poolId }, { OutputKey: 'UserPoolClientId', OutputValue: settings.clientId },
  { OutputKey: 'ApiEndpoint', OutputValue: 'https://api.production.example' }, { OutputKey: 'DbEndpoint', OutputValue: settings.directoryHost },
] };
const resources = { StackResourceSummaries: [
  { LogicalResourceId: 'Vpc', PhysicalResourceId: 'vpc-prod' }, { LogicalResourceId: 'LambdaSecurityGroup', PhysicalResourceId: 'sg-prod' },
  { LogicalResourceId: 'SubnetA', PhysicalResourceId: 'subnet-a' }, { LogicalResourceId: 'SubnetB', PhysicalResourceId: 'subnet-b' },
] };
const subnets = { Subnets: [{ SubnetId: 'subnet-a', AvailabilityZone: 'us-east-2a' }, { SubnetId: 'subnet-b', AvailabilityZone: 'us-east-2b' }] };

it('accepts only the matching live production identity, API and directory network', () => {
  expect(verifyProductionBoundary(settings, identity, stack, resources, subnets)).toEqual({ target: 'production', verified: true });
  expect(() => verifyProductionBoundary({ ...settings, target: 'dev' }, identity, stack, resources, subnets)).toThrow('not verified');
  expect(() => verifyProductionBoundary(settings, { Account: 'another' }, stack, resources, subnets)).toThrow('not verified');
  expect(() => verifyProductionBoundary({ ...settings, poolId: 'staging-pool' }, identity, stack, resources, subnets)).toThrow('do not match');
  expect(() => verifyProductionBoundary({ ...settings, directoryHost: 'staging-host' }, identity, stack, resources, subnets)).toThrow('do not match');
  expect(() => verifyProductionBoundary({ ...settings, securityGroupId: 'sg-other' }, identity, stack, resources, subnets)).toThrow('do not match');
  expect(() => verifyProductionBoundary(settings, identity, stack, resources, { Subnets: [{ SubnetId: 'subnet-a', AvailabilityZone: 'us-east-2b' }, subnets.Subnets[1]] })).toThrow('do not match');
});
