import { defineFunction } from '@aws-amplify/backend';

export const verifyAttachment = defineFunction({
  name: 'verify-feedback-attachment',
  entry: './handler.ts',
  resourceGroupName: 'storage',
  timeoutSeconds: 15,
});
