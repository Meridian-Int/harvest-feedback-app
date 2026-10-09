import { defineFunction, secret } from '@aws-amplify/backend';

export const sentryIssues = defineFunction({
  name: 'sentry-issues',
  entry: './handler.ts',
  environment: {
    // A sandbox without Sentry configuration can deploy and show the setup state.
    ...(process.env.SENTRY_ORG ? { SENTRY_AUTH_TOKEN: secret('SENTRY_AUTH_TOKEN') } : {}),
    SENTRY_ORG: process.env.SENTRY_ORG ?? '',
    SENTRY_PROJECTS: process.env.SENTRY_PROJECTS ?? 'harvest-ui,harvest-api,feedback-app',
  },
});
