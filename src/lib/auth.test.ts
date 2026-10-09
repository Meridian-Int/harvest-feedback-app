import { beforeEach, vi } from 'vitest';
import { confirmSignIn, getCurrentUser, isAdmin, isValidEmail, requireUser, restoreSession, signIn, signOut } from './auth';

const cognito = vi.hoisted(() => ({
  signIn: vi.fn(), confirmSignIn: vi.fn(), signOut: vi.fn(),
  getCurrentUser: vi.fn(), fetchUserAttributes: vi.fn(), fetchAuthSession: vi.fn(),
}));
vi.mock('aws-amplify/auth', () => cognito);
vi.mock('./amplify', () => ({ isAmplifyConfigured: () => true, requireAmplify: vi.fn() }));

beforeEach(async () => {
  vi.clearAllMocks();
  cognito.signIn.mockResolvedValue({ nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE' } });
  cognito.confirmSignIn.mockResolvedValue({ nextStep: { signInStep: 'DONE' } });
  cognito.getCurrentUser.mockResolvedValue({ userId: 'user-1' });
  cognito.fetchUserAttributes.mockResolvedValue({ email: 'admin@example.com', name: 'Admin', 'custom:persona': 'Operator', 'custom:company': 'Meridian' });
  cognito.fetchAuthSession.mockResolvedValue({ tokens: { idToken: { payload: { 'cognito:groups': ['admins'] } } } });
  await signOut();
});

it('validates the email and requests an email OTP through Cognito', async () => {
  expect(isValidEmail('bad')).toBe(false);
  await expect(signIn('bad')).rejects.toThrow('Enter a valid work email.');
  await signIn('  ADMIN@EXAMPLE.COM  ');
  expect(cognito.signIn).toHaveBeenCalledWith({ username: 'admin@example.com', options: { authFlowType: 'USER_AUTH', preferredChallenge: 'EMAIL_OTP' } });
});

it('confirms six digits and uses Cognito attributes and groups', async () => {
  await expect(confirmSignIn('123')).rejects.toThrow('6-digit');
  const user = await confirmSignIn('123456');
  expect(cognito.confirmSignIn).toHaveBeenCalledWith({ challengeResponse: '123456' });
  expect(user).toEqual({ id: 'user-1', email: 'admin@example.com', name: 'Admin', persona: 'Operator', company: 'Meridian', groups: ['admins'] });
  expect(isAdmin(user)).toBe(true);
  expect(requireUser()).toEqual(user);
});

it('shows a real wrong-code message and restores an existing session', async () => {
  cognito.confirmSignIn.mockRejectedValueOnce(Object.assign(new Error('mismatch'), { name: 'CodeMismatchException' }));
  await expect(confirmSignIn('000000')).rejects.toThrow('That code is not right.');
  expect(await restoreSession()).toMatchObject({ id: 'user-1', groups: ['admins'] });
});

it('rejects incomplete profiles and clears local identity on sign-out', async () => {
  cognito.fetchUserAttributes.mockResolvedValueOnce({ email: 'admin@example.com', name: 'Admin' });
  await expect(confirmSignIn('123456')).rejects.toThrow('valid persona');
  await confirmSignIn('123456');
  await signOut();
  expect(getCurrentUser()).toBeNull();
  expect(isAdmin(null)).toBe(false);
  expect(() => requireUser()).toThrow('Sign in');
});

it('treats an expired Cognito session as signed out', async () => {
  cognito.getCurrentUser.mockRejectedValueOnce(Object.assign(new Error('expired'), { name: 'UserUnAuthenticatedException' }));
  expect(await restoreSession()).toBeNull();
  expect(getCurrentUser()).toBeNull();
});

it('refuses an unexpected Cognito challenge instead of opening the code screen', async () => {
  cognito.signIn.mockResolvedValueOnce({ nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_PASSWORD' } });
  await expect(signIn('admin@example.com')).rejects.toThrow('Email verification is unavailable');
});

it('uses an empty group list for clients without a Cognito group claim', async () => {
  cognito.fetchAuthSession.mockResolvedValueOnce({ tokens: { idToken: { payload: {} } } });
  const user = await confirmSignIn('123456');
  expect(user.groups).toEqual([]);
  expect(isAdmin(user)).toBe(false);
});
