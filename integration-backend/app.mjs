import { Stack, CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Table, AttributeType, BillingMode, ProjectionType, StreamViewType } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket, BlockPublicAccess, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { GraphqlApi, AuthorizationType, Definition, MappingTemplate } from 'aws-cdk-lib/aws-appsync';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { Vpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { DynamoEventSource, SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Distribution, Function as EdgeFunction, FunctionCode, FunctionEventType, ViewerProtocolPolicy, CachePolicy, ResponseHeadersPolicy, HeadersFrameOption, HeadersReferrerPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
export function integrationStack(app, settings) {
  const { target, account, region, poolId, clientId, apiUrl, origins } = settings;
  const production = target === 'production';
  if (!['dev', 'test', 'production'].includes(target) || account !== '938463256739' || region !== 'us-east-2' || !/^[a-z0-9]+$/.test(clientId)) throw new Error('Unapproved Feedback environment.');
  if (production ? poolId !== 'us-east-2_oadf82ZLn' || clientId !== '2igh4vncukumgslfn9u17ancuo' : poolId !== 'us-east-2_9T9vblhIf' || clientId !== '1kgpn379o3obvefdfrms9pp6ho') throw new Error('Feedback identity does not match its HARVEST environment.');
  const base = new URL(apiUrl);
  if (base.origin !== (production ? 'https://5fbi1qzdl5.execute-api.us-east-2.amazonaws.com' : 'https://hjyuhqzj1i.execute-api.us-east-2.amazonaws.com') || base.pathname !== '/' || base.search || base.hash) throw new Error('Feedback API does not match its HARVEST environment.');
  const allowedOrigins = production ? ['https://harvestbymeridian.ai'] : target === 'dev' ? ['https://harvest-refresh-prestaging-meridian.netlify.app', 'https://staging.harvestbymeridian.ai', 'https://harvest-refresh-staging-meridian.netlify.app', 'http://localhost:5173'] : ['https://staging.harvestbymeridian.ai', 'https://harvest-refresh-staging-meridian.netlify.app'];
  if (!origins.length || origins.some(origin => !allowedOrigins.includes(origin))) throw new Error('Unapproved browser origin.');
  const directoryHost = settings.directoryHost;
  if (!new RegExp(`^harvest-refresh-${production ? 'production' : 'staging'}\\.[a-z0-9]+\\.us-east-2\\.rds\\.amazonaws\\.com$`).test(directoryHost ?? '') || !/^vpc-[a-f0-9]+$/.test(settings.vpcId ?? '') || !Array.isArray(settings.subnetIds) || settings.subnetIds.length < 2 || settings.subnetIds.some(id => !/^subnet-[a-f0-9]+$/.test(id)) || !/^sg-[a-f0-9]+$/.test(settings.securityGroupId ?? '') || !Array.isArray(settings.availabilityZones) || settings.availabilityZones.length !== settings.subnetIds.length || settings.availabilityZones.some(zone => !/^us-east-2[a-c]$/.test(zone))) throw new Error('Feedback directory network does not match its HARVEST environment.');
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
  resolver.addEnvironment('SENTRY_ORG', 'meridian-zt');
  resolver.addEnvironment('SENTRY_PROJECT', 'javascript-react');
  resolver.addEnvironment('SENTRY_ENVIRONMENT', target === 'dev' ? 'prestaging' : target === 'test' ? 'staging' : 'production');
  if (settings.sentryTokenSecretArn) {
    if (!new RegExp(`^arn:aws:secretsmanager:us-east-2:938463256739:secret:harvest-feedback/${target}/[A-Za-z0-9/_+=.@-]+$`).test(settings.sentryTokenSecretArn)) throw new Error('Sentry token must be a Feedback secret for the matching environment.');
    const sentryToken = Secret.fromSecretCompleteArn(stack, 'SentryReadToken', settings.sentryTokenSecretArn);
    sentryToken.grantRead(resolver);
    resolver.addEnvironment('SENTRY_TOKEN_SECRET_ARN', settings.sentryTokenSecretArn);
  }
  if (settings.ga4SecretArn || settings.ga4PropertyId) {
    if (!new RegExp(`^arn:aws:secretsmanager:us-east-2:938463256739:secret:harvest-refresh/${production ? 'production' : 'staging'}/google-analytics-[A-Za-z0-9]{6}$`).test(settings.ga4SecretArn ?? '') || !/^\d+$/.test(settings.ga4PropertyId ?? '')) throw new Error('GA4 must use the matching HARVEST credential secret and numeric property ID.');
    const ga4Secret = Secret.fromSecretCompleteArn(stack, 'HarvestGa4Read', settings.ga4SecretArn);
    ga4Secret.grantRead(resolver);
    resolver.addEnvironment('GA4_SECRET_ARN', settings.ga4SecretArn);
    resolver.addEnvironment('GA4_PROPERTY_ID', settings.ga4PropertyId);
  }
  reports.grantReadWriteData(resolver); reads.grantReadWriteData(resolver); attachments.grantReadWriteData(resolver); admins.grantReadData(resolver);
  bucket.grantReadWrite(resolver);
  const pool = UserPool.fromUserPoolId(stack, 'HarvestPool', poolId);
  const directorySecret = new Secret(stack, 'DirectorySecret', { secretName: `harvest-feedback/integration/${target}/directory`, generateSecretString: {
    secretStringTemplate: JSON.stringify({ username: `harvest_feedback_${target}_directory`, host: directoryHost, dbname: 'harvest_refresh' }), generateStringKey: 'password', passwordLength: 40,
  } });
  const directoryVpc = Vpc.fromVpcAttributes(stack, 'DirectoryVpc', { vpcId: settings.vpcId, availabilityZones: settings.availabilityZones, privateSubnetIds: settings.subnetIds });
  const directoryGroup = SecurityGroup.fromSecurityGroupId(stack, 'DirectoryNetwork', settings.securityGroupId, { mutable: false });
  const directory = new NodejsFunction(stack, 'HarvestDirectory', { functionName: `harvest-feedback-${target}-directory`, entry: path.join(root, 'directory.ts'), runtime: Runtime.NODEJS_22_X, timeout: Duration.seconds(20), memorySize: 256,
    vpc: directoryVpc, securityGroups: [directoryGroup], environment: { FEEDBACK_TARGET: target, ...(production ? { HARVEST_DIRECTORY_HOST: directoryHost } : {}), DIRECTORY_SECRET_ARN: directorySecret.secretArn }, bundling: { minify: true, sourceMap: false, externalModules: [], commandHooks: {
      beforeBundling: () => [], beforeInstall: () => [], afterBundling: (_input, output) => [`node -e "require('node:fs').copyFileSync(process.argv[1], process.argv[2])" "${path.join(root, 'rds-ca.pem')}" "${path.join(output, 'rds-ca.pem')}"`],
    } },
  });
  directorySecret.grantRead(directory);
  resolver.addEnvironment('HARVEST_DIRECTORY_FUNCTION_ARN', directory.functionArn);
  directory.grantInvoke(resolver);
  resolver.addToRolePolicy(new PolicyStatement({ actions: ['cognito-idp:AdminGetUser'], resources: [pool.userPoolArn] }));
  const api = new GraphqlApi(stack, 'Api', { name: `harvest-feedback-integration-${target}`, definition: Definition.fromFile(path.join(root, 'schema.graphql')), authorizationConfig: { defaultAuthorization: { authorizationType: AuthorizationType.USER_POOL, userPoolConfig: { userPool: pool, appIdClientRegex: `^${clientId}$` } } } });
  const source = api.addLambdaDataSource('Operations', resolver);
  for (const [typeName, fields] of Object.entries({ Query: ['harvestViewer', 'feedbackAdministrators', 'listFeedbacks', 'getFeedback', 'listNotificationReads', 'getNotificationRead', 'attachmentAccess', 'sentryIssues', 'trafficInsights'], Mutation: ['submitFeedback', 'updateFeedback', 'createNotificationRead', 'prepareAttachment', 'removeAttachment'] })) {
    for (const fieldName of fields) source.createResolver(`${typeName}${fieldName}`, { typeName, fieldName, requestMappingTemplate: MappingTemplate.lambdaRequest(), responseMappingTemplate: MappingTemplate.fromString('#if($ctx.error)\n$util.error($ctx.error.message, $ctx.error.type)\n#end\n$util.toJson($ctx.result)') });
  }
  const receipts = new Table(stack, 'EmailDelivery', { partitionKey: { name: 'id', type: AttributeType.STRING }, billingMode: BillingMode.PAY_PER_REQUEST, timeToLiveAttribute: 'expiresAt', removalPolicy: RemovalPolicy.RETAIN });
  const failures = new Queue(stack, 'FailedFeedbackEmail', { retentionPeriod: Duration.days(14) });
  const emailEnabled = settings.emailEnabled === true;
  const baseUrl = settings.appBaseUrl ?? `${origins.find(origin => origin.startsWith('https:'))}/feedback`;
  const emailSite = new URL(baseUrl);
  if (!origins.includes(emailSite.origin) || emailSite.pathname !== '/feedback' || emailSite.username || emailSite.password || emailSite.search || emailSite.hash) throw new Error('Email links must use an approved Feedback origin.');
  const email = new NodejsFunction(stack, 'EmailWorker', { entry: path.join(root, 'email-worker.ts'), runtime: Runtime.NODEJS_22_X, timeout: Duration.seconds(60), memorySize: 512, bundling: { minify: true, sourceMap: false, externalModules: [] }, environment: {
    HARVEST_USER_POOL_ID: poolId, ADMINS_TABLE: admins.tableName, HARVEST_DIRECTORY_FUNCTION_ARN: directory.functionArn,
    FEEDBACK_TARGET: target, FEEDBACK_EMAIL_ENABLED: String(emailEnabled), EMAIL_DELIVERY_TABLE: receipts.tableName, APP_BASE_URL: baseUrl,
    CLIENT_NOTIFICATION_FROM_EMAIL: 'sahil+feedback@withmeridian.ai', ADMIN_NOTIFICATION_FROM_EMAIL: 'manasa+feedback@withmeridian.ai',
  } });
  receipts.grantReadWriteData(email); admins.grantReadData(email); directory.grantInvoke(email);
  email.addToRolePolicy(new PolicyStatement({ actions: ['cognito-idp:AdminGetUser'], resources: [pool.userPoolArn] }));
  email.addToRolePolicy(new PolicyStatement({ actions: ['ses:SendEmail'], resources: [stack.formatArn({ service: 'ses', resource: 'identity', resourceName: 'withmeridian.ai' })], conditions: { StringEquals: { 'ses:FromAddress': ['sahil+feedback@withmeridian.ai', 'manasa+feedback@withmeridian.ai'] } } }));
  email.addEventSource(new DynamoEventSource(reports, { startingPosition: StartingPosition.LATEST, enabled: emailEnabled, batchSize: 10, reportBatchItemFailures: true, retryAttempts: 10, onFailure: new SqsDlq(failures) }));

  // The same committed events feed HARVEST's existing operator bell. Delivery
  // is independent of optional email and retries through its own dead-letter queue.
  let notificationFailures;
  if (!production || settings.harvestNotificationsEnabled === true) {
    const notificationSecretName = `harvest-refresh/${production ? 'production' : 'staging'}/feedback-notifications`;
    const notificationSecret = Secret.fromSecretNameV2(stack, 'HarvestNotificationSecret', notificationSecretName);
    notificationFailures = new Queue(stack, 'FailedHarvestNotification', { retentionPeriod: Duration.days(14) });
    const notificationWorker = new NodejsFunction(stack, 'HarvestNotificationWorker', { entry: path.join(root, 'harvest-notification-worker.ts'), runtime: Runtime.NODEJS_22_X, timeout: Duration.seconds(30), memorySize: 256, bundling: { minify: true, sourceMap: false, externalModules: [] }, environment: {
      HARVEST_API_BASE_URL: apiUrl, HARVEST_NOTIFICATION_SECRET_NAME: notificationSecretName,
    } });
    notificationSecret.grantRead(notificationWorker);
    notificationWorker.addEventSource(new DynamoEventSource(reports, { startingPosition: StartingPosition.LATEST, batchSize: 10, reportBatchItemFailures: true, retryAttempts: 10, onFailure: new SqsDlq(notificationFailures) }));
  }

  // This is a private static origin for HARVEST's reverse proxy, not a second login.
  const ui = new Bucket(stack, 'Ui', { blockPublicAccess: BlockPublicAccess.BLOCK_ALL, encryption: BucketEncryption.S3_MANAGED, enforceSSL: true, removalPolicy: RemovalPolicy.RETAIN });
  const routing = new EdgeFunction(stack, 'FeedbackRoutes', { code: FunctionCode.fromInline(`function handler(event) {
    var request = event.request;
    if (request.uri.indexOf('/feedback/assets/') === 0) { request.uri = request.uri.slice(9); return request; }
    if (request.uri === '/feedback' || request.uri.indexOf('/feedback/') === 0) { request.uri = '/index.html'; return request; }
    return { statusCode: 404, statusDescription: 'Not Found' };
  }`) });
  // Netlify does not apply its local headers to proxied responses. Serve the
  // Feedback document's policy from this origin, including its media previews.
  const headers = new ResponseHeadersPolicy(stack, 'FeedbackHeaders', { securityHeadersBehavior: {
    contentSecurityPolicy: { override: true, contentSecurityPolicy: "default-src 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; font-src 'self'; connect-src 'self' https:; frame-src https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
    contentTypeOptions: { override: true }, frameOptions: { override: true, frameOption: HeadersFrameOption.DENY }, referrerPolicy: { override: true, referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN },
    strictTransportSecurity: { override: true, accessControlMaxAge: Duration.days(365) },
  }, customHeadersBehavior: { customHeaders: [{ header: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()', override: true }, { header: 'Cache-Control', value: 'no-store', override: true }] } });
  const site = new Distribution(stack, 'FeedbackSite', { defaultBehavior: { origin: S3BucketOrigin.withOriginAccessControl(ui), viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: CachePolicy.CACHING_DISABLED, responseHeadersPolicy: headers, functionAssociations: [{ function: routing, eventType: FunctionEventType.VIEWER_REQUEST }] } });
  // No identity pool, generated model CRUD, IAM API provider or Cognito mutations.
  new CfnOutput(stack, 'GraphqlUrl', { value: api.graphqlUrl });
  new CfnOutput(stack, 'MediaBucket', { value: bucket.bucketName });
  new CfnOutput(stack, 'AdminAssignmentsTable', { value: admins.tableName });
  new CfnOutput(stack, 'ReportsTable', { value: reports.tableName });
  new CfnOutput(stack, 'UserPoolId', { value: poolId });
  new CfnOutput(stack, 'UserPoolClientId', { value: clientId });
  new CfnOutput(stack, 'UiBucket', { value: ui.bucketName });
  new CfnOutput(stack, 'FeedbackSiteOrigin', { value: `https://${site.distributionDomainName}` });
  new CfnOutput(stack, 'DistributionId', { value: site.distributionId });
  new CfnOutput(stack, 'EmailFailureQueue', { value: failures.queueUrl });
  if (notificationFailures) new CfnOutput(stack, 'HarvestNotificationFailureQueue', { value: notificationFailures.queueUrl });
  new CfnOutput(stack, 'DirectorySecretArn', { value: directorySecret.secretArn });
  new CfnOutput(stack, 'DirectoryFunction', { value: directory.functionName });
  return stack;
}
