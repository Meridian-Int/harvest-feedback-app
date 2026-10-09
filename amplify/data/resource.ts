import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

// Field rules replace model rules. Every immutable value is therefore protected
// explicitly so an owner can request an update without editing report content.
const schema = a.schema({
  Priority: a.enum(['BLOCKER', 'BUG', 'IMPROVEMENT']),
  Severity: a.enum(['CRITICAL', 'MEDIUM', 'LOW']),
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
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    reporterEmail: a.string().required().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    persona: a.string().required().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
    ]),
    company: a.string().required().authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('admins').to(['create', 'read']),
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
    // Amplify Gen 2 cannot default an enum field. A scalar default prevents
    // callers from choosing a status on create; admin updates are validated
    // by the shared API and must be checked through the deployed API as well.
    status: a.string().default('NEW').authorization((allow) => [
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
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
