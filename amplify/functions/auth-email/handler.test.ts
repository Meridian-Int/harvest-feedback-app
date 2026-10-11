import { expect, it } from 'vitest';
import { handler } from './handler';
it('uses the supplied design and preserves Cognito’s verification placeholder', async () => {
  const result = await handler({ triggerSource: 'CustomMessage_SignUp', request: { codeParameter: '{####}' }, response: {} });
  expect(result.response.emailMessage).toContain('{####}');
  expect(result.response.emailMessage).toContain('background:#eee9df');
  expect(result.response.emailMessage).toContain('then create your password');
  expect(result.response.emailSubject).toBe('Your HARVEST Feedback verification code');
});
it('does not describe password reset as a signup', async () => {
  const result = await handler({ triggerSource: 'CustomMessage_ForgotPassword', request: { codeParameter: '{####}' }, response: {} });
  expect(result.response.emailMessage).toContain('Reset your password');
  expect(result.response.emailMessage).not.toContain('then create your password');
});
it('does not modify unrelated Cognito messages', async () => {
  const event = { triggerSource: 'CustomMessage_AdminCreateUser', request: { codeParameter: '{####}' }, response: {} };
  expect(await handler(event)).toBe(event);
  expect(event.response).toEqual({});
});
