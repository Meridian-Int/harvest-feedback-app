import { defineFunction } from '@aws-amplify/backend';

export const harvestViewer = defineFunction({
  name: 'harvest-feedback-viewer',
  entry: './handler.ts',
  resourceGroupName: 'data',
  timeoutSeconds: 10,
  environment: {
    HARVEST_API_BASE_URL: process.env.HARVEST_API_BASE_URL ?? '',
  },
});
