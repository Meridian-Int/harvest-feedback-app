import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const stackName = 'harvest-feedback-integration-dev';
const permitted = {
  ApiQuerytrafficInsights9240190F: { change: 'add', type: 'AWS::AppSync::Resolver' },
  ResolverServiceRoleDefaultPolicy2280CADF: { change: 'update', type: 'AWS::IAM::Policy' },
  ResolverE74F069E: { change: 'update', type: 'AWS::Lambda::Function' },
  ApiSchema510EECD7: { change: 'update', type: 'AWS::AppSync::GraphQLSchema' },
};
const canonical = value => JSON.stringify(value, (_key, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

/** Refuse any stack drift or release outside the reviewed Insights resources. */
export function verifyDeployScope(live, proposed) {
  const liveOther = { ...live }, proposedOther = { ...proposed };
  delete liveOther.Resources; delete proposedOther.Resources;
  assert.equal(canonical(proposedOther), canonical(liveOther), 'Stack parameters, outputs or metadata changed.');
  const oldResources = live.Resources ?? {}, newResources = proposed.Resources ?? {};
  const changed = [];
  for (const id of new Set([...Object.keys(oldResources), ...Object.keys(newResources)])) {
    const before = oldResources[id], after = newResources[id];
    if (canonical(before) === canonical(after)) continue;
    const rule = permitted[id];
    assert.ok(rule, `Unreviewed CloudFormation resource change: ${id}`);
    assert.ok(after && after.Type === rule.type, `Unexpected resource type: ${id}`);
    assert.ok(rule.change === (before ? 'update' : 'add'), `Unexpected resource operation: ${id}`);
    if (id === 'ApiQuerytrafficInsights9240190F') {
      assert.equal(after.Properties.TypeName, 'Query');
      assert.equal(after.Properties.FieldName, 'trafficInsights');
    }
    if (id === 'ResolverE74F069E') {
      const prior = { ...before.Properties }, next = { ...after.Properties };
      delete prior.Code; delete next.Code;
      const oldEnvironment = prior.Environment?.Variables ?? {}, newEnvironment = next.Environment?.Variables ?? {};
      delete prior.Environment; delete next.Environment;
      assert.equal(canonical(next), canonical(prior), 'Resolver properties other than code and environment changed.');
      for (const [key, value] of Object.entries(oldEnvironment)) assert.equal(canonical(newEnvironment[key]), canonical(value), `Existing resolver setting changed: ${key}`);
      const added = Object.keys(newEnvironment).filter(key => !(key in oldEnvironment)).sort();
      assert.equal(canonical(added), canonical(['GA4_PROPERTY_ID', 'GA4_SECRET_ARN', 'SENTRY_ENVIRONMENT', 'SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_TOKEN_SECRET_ARN'].sort()));
      assert.equal(newEnvironment.SENTRY_ENVIRONMENT, 'prestaging');
      assert.equal(newEnvironment.GA4_PROPERTY_ID, '558205575');
    }
    if (id === 'ResolverServiceRoleDefaultPolicy2280CADF') {
      const oldStatements = before.Properties.PolicyDocument.Statement;
      const newStatements = after.Properties.PolicyDocument.Statement;
      const oldKeys = new Set(oldStatements.map(canonical));
      for (const key of oldKeys) assert.ok(newStatements.some(statement => canonical(statement) === key), 'Existing resolver IAM grant changed.');
      const added = newStatements.filter(statement => !oldKeys.has(canonical(statement)));
      assert.equal(added.length, 2, 'Expected exactly the two Insights secret read grants.');
      const resolver = newResources.ResolverE74F069E.Properties.Environment.Variables;
      const expectedArns = [resolver.SENTRY_TOKEN_SECRET_ARN, resolver.GA4_SECRET_ARN].sort();
      for (const statement of added) {
        assert.equal(statement.Effect, 'Allow');
        assert.equal(canonical([...statement.Action].sort()), canonical(['secretsmanager:DescribeSecret', 'secretsmanager:GetSecretValue']));
      }
      assert.equal(canonical(added.map(statement => statement.Resource).sort()), canonical(expectedArns), 'IAM grants include an unexpected secret.');
    }
    changed.push(id);
  }
  return changed.sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.env.FEEDBACK_TARGET, 'dev', 'Only Feedback dev can pass this deployment gate.');
  const arn = process.env.FEEDBACK_SENTRY_TOKEN_SECRET_ARN;
  assert.ok(/^arn:aws:secretsmanager:us-east-2:938463256739:secret:harvest-feedback\/dev\/sentry-issues-read-token-[A-Za-z0-9]{6}$/.test(arn ?? ''), 'The approved Feedback dev Sentry secret is required.');
  const proposed = JSON.parse(readFileSync(path.join('cdk.out', `${stackName}.template.json`), 'utf8'));
  const resolver = proposed.Resources.ResolverE74F069E.Properties.Environment.Variables;
  assert.equal(resolver.SENTRY_TOKEN_SECRET_ARN, arn);
  assert.equal(resolver.GA4_PROPERTY_ID, '558205575');
  assert.equal(proposed.Resources.ApiQuerytrafficInsights9240190F.Properties.FieldName, 'trafficInsights');
  const aws = process.env.AWS_CLI_PATH || 'aws';
  const result = JSON.parse(execFileSync(aws, ['cloudformation', 'get-template', '--stack-name', stackName, '--region', 'us-east-2', '--output', 'json'], { encoding: 'utf8' }));
  const live = typeof result.TemplateBody === 'string' ? JSON.parse(result.TemplateBody) : result.TemplateBody;
  const changed = verifyDeployScope(live, proposed);
  console.log(`Reviewed Feedback dev scope: ${changed.length ? changed.join(', ') : 'no backend changes'}.`);
}
