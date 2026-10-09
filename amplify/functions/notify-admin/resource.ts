import { defineFunction } from '@aws-amplify/backend';

export const notifyAdmin = defineFunction({
  name: 'notify-feedback-admin',
  entry: './handler.ts',
  resourceGroupName: 'data',
  timeoutSeconds: 15,
  environment: {
    ADMIN_NOTIFICATION_FROM_EMAIL: process.env.ADMIN_NOTIFICATION_FROM_EMAIL ?? '',
    APP_BASE_URL: process.env.APP_BASE_URL ?? '',
  },
});
