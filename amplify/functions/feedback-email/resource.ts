import { defineFunction } from '@aws-amplify/backend';

export const feedbackEmailDelivery = defineFunction({
  name: 'feedback-email-delivery', entry: './handler.ts', resourceGroupName: 'data', timeoutSeconds: 60,
  environment: {
    CLIENT_NOTIFICATION_FROM_EMAIL: process.env.CLIENT_NOTIFICATION_FROM_EMAIL ?? 'sahil+feedback@withmeridian.ai',
    ADMIN_NOTIFICATION_FROM_EMAIL: process.env.ADMIN_NOTIFICATION_FROM_EMAIL ?? 'manasa+feedback@withmeridian.ai',
    APP_BASE_URL: process.env.APP_BASE_URL ?? '',
    FEEDBACK_EMAIL_ENABLED: process.env.FEEDBACK_EMAIL_ENABLED ?? 'false',
  },
});
