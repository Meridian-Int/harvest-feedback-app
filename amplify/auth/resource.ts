import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: { otpLogin: true },
  },
  groups: ['admins'],
  userAttributes: {
    fullname: { required: true, mutable: false },
    'custom:clientPersona': { dataType: 'String', mutable: true, minLen: 1, maxLen: 32 },
    'custom:persona': { dataType: 'String', mutable: false, minLen: 1, maxLen: 32 },
    'custom:company': { dataType: 'String', mutable: false, minLen: 1, maxLen: 128 },
  },
});
