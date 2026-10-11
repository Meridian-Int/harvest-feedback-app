import { defineFunction } from '@aws-amplify/backend';

export const harvestReportActor = defineFunction({
  name: 'harvest-feedback-report-actor',
  entry: './handler.ts',
  resourceGroupName: 'data',
  timeoutSeconds: 10,
  environment: {
    HARVEST_API_BASE_URL: process.env.HARVEST_API_BASE_URL ?? '',
    HARVEST_STAGING_USER_POOL_ID: process.env.HARVEST_STAGING_USER_POOL_ID ?? '',
  },
});
