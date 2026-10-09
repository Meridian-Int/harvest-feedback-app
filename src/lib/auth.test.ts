import { beforeEach, vi } from 'vitest';
import { confirmSignIn, createAccountPassword, getCurrentUser, hasAccountPassword, isAdmin, isValidEmail, requireUser, restoreSession, signIn, signInWithPassword, signOut, validateNewPassword } from './auth';

const passwordSdk = vi.hoisted(() => ({ send: vi.fn(), getConfig: vi.fn() }));
vi.mock('aws-amplify', () => ({ Amplify: { getConfig: passwordSdk.getConfig } }));
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class { send = passwordSdk.send; },
  ChangePasswordCommand: class { constructor(public input: unknown) {} },
  GetUserAuthFactorsCommand: class { constructor(public input: unknown) {} },
}));

const cognito = vi.hoisted(() => ({
  signIn: vi.fn(), confirmSignIn: vi.fn(), signOut: vi.fn(),
  updateUserAttributes: vi.fn(), getCurrentUser: vi.fn(), fetchUserAttributes: vi.fn(), fetchAuthSession: vi.fn(),
}));
vi.mock('aws-amplify/auth', () => cognito);
vi.mock('./amplify', () => ({ isAmplifyConfigured: () => true, requireAmplify: vi.fn() }));

beforeEach(async () => {
  vi.clearAllMocks();
  passwordSdk.getConfig.mockReturnValue({ Auth: { Cognito: { userPoolId: 'us-east-2_test' } } });
  passwordSdk.send.mockResolvedValue({});
  cognito.signIn.mockResolvedValue({ nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE' } });
  cognito.confirmSignIn.mockResolvedValue({ nextStep: { signInStep: 'DONE' } });
  cognito.getCurrentUser.mockResolvedValue({ userId: 'user-1' });
  cognito.fetchUserAttributes.mockResolvedValue({ email: 'admin@example.com', name: 'Admin', 'custom:persona': 'Operator', 'custom:company': 'Meridian' });
  cognito.fetchAuthSession.mockResolvedValue({ tokens: { idToken: { payload: { 'cognito:groups': ['admins'] } } } });
  await signOut();
});

it('validates password complexity and confirmation without service calls', () => {
  for (const value of ['short', 'lowercase-only-password', 'NoDigitsOrSymbols', 'HasSpace 123!abc', 'A1!'.repeat(50)]) {
    expect(() => validateNewPassword(value, value)).toThrow('12–128');
  }
  expect(() => validateNewPassword('Test-password-2468!', 'different')).toThrow('do not match');
  expect(() => validateNewPassword('Test-password-2468!', 'Test-password-2468!')).not.toThrow();
  expect(passwordSdk.send).not.toHaveBeenCalled();
});

it('creates an initial password for the authenticated user without passing PreviousPassword', async () => {
  await confirmSignIn('65432187');
  cognito.fetchAuthSession.mockResolvedValueOnce({ tokens: { accessToken: { toString: () => 'access-token' } } });
  await expect(createAccountPassword('Test-password-2468!', 'Test-password-2468!')).resolves.toMatchObject({ id: 'user-1' });
  expect(passwordSdk.send.mock.calls[0][0].input).toEqual({ AccessToken: 'access-token', ProposedPassword: 'Test-password-2468!' });
  cognito.fetchAuthSession.mockResolvedValueOnce({ tokens: { accessToken: { toString: () => 'access-token' } } });
  passwordSdk.send.mockRejectedValueOnce(Object.assign(new Error('Already set'), { name: 'InvalidParameterException', message: 'Missing required parameter OldPassword' }));
  await expect(createAccountPassword('Test-password-2468!', 'Test-password-2468!')).rejects.toThrow('already set');
});

it('requires a verified session before password creation and handles service failure safely', async () => {
  await expect(createAccountPassword('Test-password-2468!', 'Test-password-2468!')).rejects.toThrow('Sign in');
  await confirmSignIn('65432187');
  await expect(createAccountPassword('Test-password-2468!', 'Test-password-2468!')).rejects.toThrow('Sign in again');
  cognito.fetchAuthSession.mockResolvedValueOnce({ tokens: { accessToken: { toString: () => 'access-token' } } });
  passwordSdk.send.mockRejectedValueOnce(new Error('private service detail'));
  await expect(createAccountPassword('Test-password-2468!', 'Test-password-2468!')).rejects.toThrow('Could not create');
});

it('signs in with a password through Cognito choice authentication, including its password challenge', async () => {
  cognito.signIn.mockResolvedValueOnce({ nextStep: { signInStep: 'DONE' } });
  await expect(signInWithPassword(' CLIENT@EXAMPLE.COM ', 'Test-password-2468!')).resolves.toMatchObject({ id: 'user-1' });
  expect(cognito.signIn).toHaveBeenCalledWith({ username: 'client@example.com', password: 'Test-password-2468!', options: { authFlowType: 'USER_AUTH', preferredChallenge: 'PASSWORD' } });
  cognito.signIn.mockResolvedValueOnce({ nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_PASSWORD' } });
  await signInWithPassword('client@example.com', 'Test-password-2468!');
  expect(cognito.confirmSignIn).toHaveBeenLastCalledWith({ challengeResponse: 'Test-password-2468!' });
});

it('rejects invalid password login and unexpected challenges without guessing', async () => {
  await expect(signInWithPassword('bad', 'password')).rejects.toThrow('valid work email');
  await expect(signInWithPassword('client@example.com', '')).rejects.toThrow('Enter your password');
  cognito.signIn.mockRejectedValueOnce(Object.assign(new Error('bad credentials'), { name: 'NotAuthorizedException' }));
  await expect(signInWithPassword('client@example.com', 'incorrect')).rejects.toThrow('Email or password');
  await expect(signInWithPassword('client@example.com', 'Test-password-2468!')).rejects.toThrow('email-code sign-in');
});

it('validates the email and requests an email OTP through Cognito', async () => {
  expect(isValidEmail('bad')).toBe(false);
  await expect(signIn('bad')).rejects.toThrow('Enter a valid work email.');
  await signIn('  ADMIN@EXAMPLE.COM  ');
  expect(cognito.signIn).toHaveBeenCalledWith({ username: 'admin@example.com', options: { authFlowType: 'USER_AUTH', preferredChallenge: 'EMAIL_OTP' } });
});

it('confirms eight digits and uses Cognito attributes and groups', async () => {
  await expect(confirmSignIn('123')).rejects.toThrow('8-digit');
  const user = await confirmSignIn('12345678');
  expect(cognito.confirmSignIn).toHaveBeenCalledWith({ challengeResponse: '12345678' });
  expect(user).toEqual({ id: 'user-1', email: 'admin@example.com', name: 'Admin', persona: 'Operator', company: 'Meridian', groups: ['admins'], needsPersonaSetup: false });
  expect(isAdmin(user)).toBe(true);
  expect(requireUser()).toEqual(user);
});

it('shows a real wrong-code message and restores an existing session', async () => {
  cognito.confirmSignIn.mockRejectedValueOnce(Object.assign(new Error('mismatch'), { name: 'CodeMismatchException' }));
  await expect(confirmSignIn('00000000')).rejects.toThrow('That code is not right.');
  expect(await restoreSession()).toMatchObject({ id: 'user-1', groups: ['admins'], needsPersonaSetup: false });
});

it('rejects incomplete profiles and clears local identity on sign-out', async () => {
  cognito.fetchUserAttributes.mockResolvedValueOnce({ email: 'admin@example.com', name: 'Admin' });
  await expect(confirmSignIn('12345678')).rejects.toThrow('valid persona');
  await confirmSignIn('12345678');
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
  const user = await confirmSignIn('12345678');
  expect(user.groups).toEqual([]);
  expect(isAdmin(user)).toBe(false);
});

it('checks the server factors for an existing password instead of prompting for a second password', async () => {
  await confirmSignIn('12345678');
  cognito.fetchAuthSession.mockResolvedValue({ tokens: { accessToken: { toString: () => 'access-token' } } });
  passwordSdk.send.mockResolvedValueOnce({ ConfiguredUserAuthFactors: ['EMAIL_OTP', 'PASSWORD'] });
  await expect(hasAccountPassword()).resolves.toBe(true);
  expect(passwordSdk.send.mock.calls[0][0].input).toEqual({ AccessToken: 'access-token' });
  passwordSdk.send.mockResolvedValueOnce({ ConfiguredUserAuthFactors: ['EMAIL_OTP'] });
  await expect(hasAccountPassword()).resolves.toBe(false);
  passwordSdk.send.mockRejectedValueOnce(new Error('private service detail'));
  await expect(hasAccountPassword()).rejects.toThrow('Could not check');
});
