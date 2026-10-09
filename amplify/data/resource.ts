import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
import { sentryIssues } from '../functions/sentry-issues/resource';

// Field rules replace model rules. Every immutable value is therefore protected
// explicitly so an owner can request an update without editing report content.
const schema = a.schema({
  Priority: a.enum(['BLOCKER', 'BUG', 'IMPROVEMENT']),
  Severity: a.enum(['CRITICAL', 'MEDIUM', 'LOW']),
  Status: a.enum(['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED']),
  SentryIssue: a.customType({
    id: a.string().required(),
    title: a.string().required(),
    culprit: a.string().required(),
    project: a.string().required(),
    level: a.string().required(),
    count: a.integer().required(),
    userCount: a.integer().required(),
    lastSeen: a.string().required(),
    permalink: a.string().required(),
    trend: a.integer().array().required(),
  }),
  SentryIssuesResult: a.customType({
    configured: a.boolean().required(),
    issues: a.ref('SentryIssue').array().required(),
  }),
  Feedback: a.model({
    title: a.string().required().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    description: a.string().required().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    productArea: a.string().required().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    customArea: a.string().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    priority: a.ref('Priority').required().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    severity: a.ref('Severity').required().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    reporterName: a.string().required().authorization((allow) => [
      allow.owner().to(['read']),
      allow.group('admins').to(['read']),
    ]),
    reporterEmail: a.string().required().authorization((allow) => [
      allow.owner().to(['read']),
      allow.group('admins').to(['read']),
    ]),
    persona: a.string().required().authorization((allow) => [
      allow.owner().to(['read']),
      allow.group('admins').to(['read']),
    ]),
    company: a.string().required().authorization((allow) => [
      allow.owner().to(['read']),
      allow.group('admins').to(['read']),
    ]),
    attachmentKey: a.string().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    attachmentName: a.string().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    attachmentType: a.string().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    attachmentSize: a.integer().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    // Creation uses submitFeedback, which sets NEW and trusted identity fields
    // on the server. Direct model creation cannot fill these required fields.
    status: a.ref('Status').required().authorization((allow) => [
      allow.owner().to(['read']),
      allow.group('admins').to(['read', 'update']),
    ]),
    assignee: a.string().authorization((allow) => [
      allow.owner().to(['read']),
      allow.group('admins').to(['read', 'update']),
    ]),
    updateRequestedAt: a.datetime().authorization((allow) => [
      allow.owner().to(['read', 'update']),
      allow.group('admins').to(['read']),
    ]),
    adminActivityAt: a.datetime().authorization((allow) => [
      allow.owner().to(['read']),
      allow.group('admins').to(['read', 'update']),
    ]),
    sentryIssueId: a.string().authorization((allow) => [
      allow.owner().to(['read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    owner: a.string().authorization((allow) => [
      allow.owner().to(['read']),
      allow.group('admins').to(['read']),
    ]),
  }).authorization((allow) => [
    allow.owner().to(['create', 'read', 'update']),
    allow.group('admins').to(['create', 'read', 'update']),
  ]),
  submitFeedback: a.mutation()
    .arguments({
      description: a.string().required(),
      productArea: a.string().required(),
      customArea: a.string(),
      priority: a.ref('Priority').required(),
      severity: a.ref('Severity').required(),
      attachmentKey: a.string(),
      attachmentName: a.string(),
      attachmentType: a.string(),
      attachmentSize: a.integer(),
      sentryIssueId: a.string(),
    })
    .returns(a.ref('Feedback'))
    .authorization((allow) => [allow.authenticated()])
    .handler([
      a.handler.custom({ dataSource: 'VerifyAttachment', entry: './verify-attachment.js' }),
      a.handler.custom({ dataSource: a.ref('Feedback'), entry: './submit-feedback.js' }),
      a.handler.custom({ dataSource: 'NotifyAdmin', entry: './notify-admin.js' }),
    ]),
  feedbackSubmitted: a.subscription()
    .for(a.ref('submitFeedback'))
    .handler(a.handler.custom({ entry: './feedback-submitted.js' }))
    .authorization((allow) => [allow.group('admins')]),
  sentryIssues: a.query()
    .returns(a.ref('SentryIssuesResult'))
    .authorization((allow) => [allow.group('admins')])
    .handler(a.handler.function(sentryIssues)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
