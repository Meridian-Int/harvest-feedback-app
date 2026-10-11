import { defineFunction } from '@aws-amplify/backend';
export const authEmail = defineFunction({ name: 'feedback-auth-email', entry: './handler.ts', resourceGroupName: 'auth' });
