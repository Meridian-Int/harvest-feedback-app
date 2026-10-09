import { defineFunction } from '@aws-amplify/backend';

export const invitePartner = defineFunction({
  name: 'invite-feedback-partner',
  entry: './handler.ts',
  resourceGroupName: 'auth',
  timeoutSeconds: 15,
});
