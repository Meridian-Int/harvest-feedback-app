import { defineAuth } from '@aws-amplify/backend';
import { authEmail } from '../functions/auth-email/resource';

export const auth = defineAuth({
  loginWith: {
    email: { otpLogin: true },
  },
  groups: ['admins'],
  ...(process.env.COGNITO_EMAIL_SOURCE_ARN ? { triggers: { customMessage: authEmail } } : {}),
  userAttributes: {
    fullname: { required: true, mutable: false },
    'custom:persona': { dataType: 'String', mutable: false, minLen: 1, maxLen: 32 },
    'custom:company': { dataType: 'String', mutable: false, minLen: 1, maxLen: 128 },
  },
});
