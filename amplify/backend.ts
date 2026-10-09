import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { sentryIssues } from './functions/sentry-issues/resource';
import { verifyAttachment } from './functions/verify-attachment/resource';

const backend = defineBackend({ auth, data, storage, sentryIssues, verifyAttachment });

const validator = backend.verifyAttachment;
validator.addEnvironment('IDENTITY_POOL_ID', backend.auth.resources.identityPoolId);
validator.addEnvironment('USER_POOL_PROVIDER', `cognito-idp.${backend.auth.resources.userPool.stack.region}.amazonaws.com/${backend.auth.resources.userPool.userPoolId}`);
validator.addEnvironment('MEDIA_BUCKET', backend.storage.resources.bucket.bucketName);
backend.storage.resources.bucket.grantRead(validator.resources.lambda, 'feedback-media/*');
backend.data.resources.graphqlApi.addLambdaDataSource('VerifyAttachment', validator.resources.lambda);

const { cfnUserPool, cfnUserPoolClient, cfnIdentityPool } = backend.auth.resources.cfnResources;

// Add the mutable account choice separately: changing the original pool schema
// would make CloudFormation attempt to recreate existing required attributes.
if (Array.isArray(cfnUserPool.schema)) {
  cfnUserPool.schema = cfnUserPool.schema.filter(attribute => !('name' in attribute) || attribute.name !== 'clientPersona');
}
const clientPersonaAttribute = new AwsCustomResource(backend.auth.resources.userPool.stack, 'AccountPersonaAttribute', {
  installLatestAwsSdk: false,
  onCreate: {
    service: 'CognitoIdentityServiceProvider',
    action: 'addCustomAttributes',
    parameters: {
      UserPoolId: backend.auth.resources.userPool.userPoolId,
      CustomAttributes: [{ Name: 'clientPersona', AttributeDataType: 'String', Mutable: true, Required: false,
        StringAttributeConstraints: { MinLength: '1', MaxLength: '32' } }],
    },
    physicalResourceId: PhysicalResourceId.of('client-persona-attribute'),
  },
  policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: [backend.auth.resources.userPool.userPoolArn] }),
});
cfnUserPoolClient.node.addDependency(clientPersonaAttribute);

// Cognito Essentials supports email OTP and optional password sign-in.
cfnUserPool.userPoolTier = 'ESSENTIALS';
cfnUserPool.adminCreateUserConfig = { allowAdminCreateUserOnly: true };
// USER_AUTH offers email OTP by default and PASSWORD after a client sets one.
cfnUserPool.addPropertyOverride('Policies.SignInPolicy.AllowedFirstAuthFactors', ['PASSWORD', 'EMAIL_OTP']);
cfnUserPoolClient.explicitAuthFlows = ['ALLOW_USER_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'];
cfnIdentityPool.allowUnauthenticatedIdentities = false;
