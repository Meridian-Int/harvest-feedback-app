import { App, Stack, CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Table, AttributeType, BillingMode, ProjectionType, StreamViewType } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket, BlockPublicAccess, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { GraphqlApi, AuthorizationType, Definition, MappingTemplate } from 'aws-cdk-lib/aws-appsync';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
export function integrationStack(app, settings) {
  const { target, account, region, poolId, clientId, apiUrl, origins } = settings;
  if (!['dev', 'test'].includes(target) || account !== '938463256739' || region !== 'us-east-2' || poolId !== 'us-east-2_9T9vblhIf' || !/^[a-z0-9]+$/.test(clientId)) throw new Error('Only the verified HARVEST staging identity is permitted.');
  const base = new URL(apiUrl);
  if (base.origin !== 'https://hjyuhqzj1i.execute-api.us-east-2.amazonaws.com' || base.pathname !== '/') throw new Error('Only the verified HARVEST staging API is permitted.');
  if (!origins.length || origins.some(origin => !['https://harvest-refresh-prestaging-meridian.netlify.app', 'https://staging.harvestbymeridian.ai', 'https://harvest-refresh-staging-meridian.netlify.app', 'http://localhost:5173'].includes(origin))) throw new Error('Unapproved browser origin.');
  const stack = new Stack(app, `harvest-feedback-integration-${target}`, { env: { account, region } });
  const makeTable = (id, byOwner = false) => {
    const value = new Table(stack, id, { partitionKey: { name: 'id', type: AttributeType.STRING }, billingMode: BillingMode.PAY_PER_REQUEST, pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true }, removalPolicy: RemovalPolicy.RETAIN, stream: id === 'Reports' ? StreamViewType.NEW_AND_OLD_IMAGES : undefined });
    if (byOwner) value.addGlobalSecondaryIndex({ indexName: 'byOwner', partitionKey: { name: 'owner', type: AttributeType.STRING }, projectionType: ProjectionType.ALL });
    return value;
  };
  const reports = makeTable('Reports', true), reads = makeTable('NotificationReads', true), admins = makeTable('AdminAssignments'), attachments = makeTable('Attachments');
  // Retain metadata until explicitly cleaned up; linked attachments never expire.
  const bucket = new Bucket(stack, 'Media', { blockPublicAccess: BlockPublicAccess.BLOCK_ALL, encryption: BucketEncryption.S3_MANAGED, enforceSSL: true, versioned: true, removalPolicy: RemovalPolicy.RETAIN, cors: [{ allowedOrigins: origins, allowedMethods: [HttpMethods.PUT, HttpMethods.GET, HttpMethods.HEAD], allowedHeaders: ['*'], exposedHeaders: ['ETag'], maxAge: 60 }] });
  const resolver = new NodejsFunction(stack, 'Resolver', { entry: path.join(root, 'handler.ts'), runtime: Runtime.NODEJS_22_X, timeout: Duration.seconds(30), memorySize: 512, bundling: { minify: true, sourceMap: false, externalModules: [] }, environment: { HARVEST_USER_POOL_ID: poolId, HARVEST_APP_CLIENT_ID: clientId, HARVEST_API_BASE_URL: apiUrl, REPORTS_TABLE: reports.tableName, READS_TABLE: reads.tableName, ADMINS_TABLE: admins.tableName, ATTACHMENTS_TABLE: attachments.tableName, MEDIA_BUCKET: bucket.bucketName } });
  reports.grantReadWriteData(resolver); reads.grantReadWriteData(resolver); attachments.grantReadWriteData(resolver); admins.grantReadData(resolver);
  bucket.grantReadWrite(resolver);
  const pool = UserPool.fromUserPoolId(stack, 'HarvestPool', poolId);
  const api = new GraphqlApi(stack, 'Api', { name: `harvest-feedback-integration-${target}`, definition: Definition.fromFile(path.join(root, 'schema.graphql')), authorizationConfig: { defaultAuthorization: { authorizationType: AuthorizationType.USER_POOL, userPoolConfig: { userPool: pool, appIdClientRegex: `^${clientId}$` } } } });
  const source = api.addLambdaDataSource('Operations', resolver);
  for (const [typeName, fields] of Object.entries({ Query: ['harvestViewer', 'listFeedbacks', 'getFeedback', 'listNotificationReads', 'getNotificationRead', 'attachmentAccess', 'sentryIssues'], Mutation: ['submitFeedback', 'updateFeedback', 'createNotificationRead', 'prepareAttachment', 'removeAttachment'] })) {
    for (const fieldName of fields) source.createResolver(`${typeName}${fieldName}`, { typeName, fieldName, requestMappingTemplate: MappingTemplate.lambdaRequest(), responseMappingTemplate: MappingTemplate.fromString('#if($ctx.error)\n$util.error($ctx.error.message, $ctx.error.type)\n#end\n$util.toJson($ctx.result)') });
  }
  // No identity pool, generated model CRUD, IAM API provider or Cognito mutations.
  new CfnOutput(stack, 'GraphqlUrl', { value: api.graphqlUrl });
  new CfnOutput(stack, 'MediaBucket', { value: bucket.bucketName });
  new CfnOutput(stack, 'AdminAssignmentsTable', { value: admins.tableName });
  new CfnOutput(stack, 'ReportsTable', { value: reports.tableName });
  new CfnOutput(stack, 'UserPoolId', { value: poolId });
  new CfnOutput(stack, 'UserPoolClientId', { value: clientId });
  return stack;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = new App();
  integrationStack(app, { target: process.env.FEEDBACK_TARGET, account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION, poolId: process.env.HARVEST_STAGING_USER_POOL_ID, clientId: process.env.HARVEST_STAGING_APP_CLIENT_ID, apiUrl: process.env.HARVEST_API_BASE_URL, origins: (process.env.FEEDBACK_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean) });
  app.synth();
}
