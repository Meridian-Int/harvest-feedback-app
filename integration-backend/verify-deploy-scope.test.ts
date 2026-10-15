import { expect, it } from 'vitest';
// @ts-expect-error The deployment gate is plain Node ESM.
import { verifyDeployScope } from './verify-deploy-scope.mjs';

const oldEnvironment = { REPORTS_TABLE: 'feedback-reports', FEEDBACK_EMAIL_ENABLED: 'true' };
const additions = {
  SENTRY_ORG: 'meridian-zt', SENTRY_PROJECT: 'javascript-react', SENTRY_ENVIRONMENT: 'prestaging',
  SENTRY_TOKEN_SECRET_ARN: 'sentry-arn', GA4_SECRET_ARN: 'ga4-arn', GA4_PROPERTY_ID: '558205575',
};
const oldResources = {
  ResolverServiceRoleDefaultPolicy2280CADF: { Type: 'AWS::IAM::Policy', Properties: { PolicyDocument: { Statement: [] } } },
  ResolverE74F069E: { Type: 'AWS::Lambda::Function', Properties: { Code: 'before', Environment: { Variables: oldEnvironment }, Runtime: 'nodejs22.x' } },
  ApiSchema510EECD7: { Type: 'AWS::AppSync::GraphQLSchema', Properties: { Definition: 'before' } },
  ReportsTable: { Type: 'AWS::DynamoDB::Table', Properties: { TableName: 'feedback-reports' } },
};
const live = { Resources: oldResources, Outputs: { Api: 'feedback-dev' } };
const proposed = () => ({ Resources: {
  ...structuredClone(oldResources),
  ResolverServiceRoleDefaultPolicy2280CADF: { Type: 'AWS::IAM::Policy', Properties: { PolicyDocument: { Statement: ['sentry-arn', 'ga4-arn'].map(Resource => ({ Effect: 'Allow', Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'], Resource })) } } },
  ResolverE74F069E: { Type: 'AWS::Lambda::Function', Properties: { Code: 'after', Environment: { Variables: { ...oldEnvironment, ...additions } }, Runtime: 'nodejs22.x' } },
  ApiSchema510EECD7: { Type: 'AWS::AppSync::GraphQLSchema', Properties: { Definition: 'after' } },
  ApiQuerytrafficInsights9240190F: { Type: 'AWS::AppSync::Resolver', Properties: { TypeName: 'Query', FieldName: 'trafficInsights' } },
}, Outputs: { Api: 'feedback-dev' } });

it('permits only the four reviewed Insights resource changes', () => {
  expect(verifyDeployScope(live, proposed())).toEqual(['ApiQuerytrafficInsights9240190F', 'ApiSchema510EECD7', 'ResolverE74F069E', 'ResolverServiceRoleDefaultPolicy2280CADF']);
});

it('rejects changes to existing report data resources', () => {
  const changed = proposed();
  changed.Resources.ReportsTable.Properties.TableName = 'different';
  expect(() => verifyDeployScope(live, changed)).toThrow('Unreviewed CloudFormation resource change: ReportsTable');
});

it('rejects changes to existing resolver settings', () => {
  const changed = proposed();
  changed.Resources.ResolverE74F069E.Properties.Environment.Variables.REPORTS_TABLE = 'other';
  expect(() => verifyDeployScope(live, changed)).toThrow('Existing resolver setting changed: REPORTS_TABLE');
});

it('rejects a broader IAM grant', () => {
  const changed = proposed();
  changed.Resources.ResolverServiceRoleDefaultPolicy2280CADF.Properties.PolicyDocument.Statement[0].Action = ['secretsmanager:*'];
  expect(() => verifyDeployScope(live, changed)).toThrow();
});
