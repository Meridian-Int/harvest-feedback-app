import {
  confirmSignIn as confirmCognitoSignIn,
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser as getCognitoUser,
  signIn as cognitoSignIn,
  signOut as cognitoSignOut,
} from 'aws-amplify/auth';
import { isAmplifyConfigured, requireAmplify } from './amplify';
import type { AuthUser } from './types';
import { Amplify } from 'aws-amplify';
import { ChangePasswordCommand, GetUserAuthFactorsCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

let currentUser: AuthUser | null = null;

export function isValidEmail(email: string): boolean {
  return email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function getCurrentUser(): AuthUser | null {
  return currentUser;
}

export function isAdmin(user: AuthUser | null): boolean {
  return Boolean(user?.groups.includes('admins'));
}

export function requireUser(): AuthUser {
  if (!currentUser) throw new Error('Sign in to Harvest');
  return currentUser;
}

async function loadUser(): Promise<AuthUser> {
  const [identity, attributes, session] = await Promise.all([
    getCognitoUser(), fetchUserAttributes(), fetchAuthSession(),
  ]);
  const clientPersona = attributes['custom:clientPersona'];
  const persona = clientPersona ?? attributes['custom:persona'];
  if (persona !== 'Company' && persona !== 'Partner' && persona !== 'Operator') {
    throw new Error('Your account is missing a valid persona. Contact an administrator.');
  }
  if (!attributes.email || !attributes.name || !attributes['custom:company']) {
    throw new Error('Your account profile is incomplete. Contact an administrator.');
  }
  const rawGroups = session.tokens?.idToken?.payload['cognito:groups'];
  currentUser = {
    id: identity.userId,
    email: attributes.email,
    name: attributes.name,
    persona,
    company: attributes['custom:company'],
    needsPersonaSetup: false,
    groups: Array.isArray(rawGroups) ? rawGroups.filter((value): value is string => typeof value === 'string') : [],
  };
  return currentUser;
}

export async function restoreSession(): Promise<AuthUser | null> {
  currentUser = null;
  if (!isAmplifyConfigured()) return null;
  try {
    return await loadUser();
  } catch (error) {
    // Missing or expired Cognito sessions are normal on the sign-in page.
    if (['UserUnAuthenticatedException', 'NotAuthorizedException'].includes((error as { name?: string }).name ?? '')) return null;
    throw error;
  }
}

export async function signIn(email: string): Promise<void> {
  if (!isValidEmail(email)) throw new Error('Enter a valid work email.');
  requireAmplify();
  const result = await cognitoSignIn({
    username: email.trim().toLowerCase(),
    options: { authFlowType: 'USER_AUTH', preferredChallenge: 'EMAIL_OTP' },
  });
  if (result.nextStep.signInStep !== 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE') {
    throw new Error('Email verification is unavailable for this account.');
  }
}

export async function confirmSignIn(code: string): Promise<AuthUser> {
  if (!/^[0-9]{8}$/.test(code)) throw new Error('Enter an 8-digit verification code.');
  requireAmplify();
  try {
    const result = await confirmCognitoSignIn({ challengeResponse: code });
    if (result.nextStep.signInStep !== 'DONE') throw new Error('Email verification is incomplete.');
    return await loadUser();
  } catch (error) {
    if (['CodeMismatchException', 'NotAuthorizedException'].includes((error as { name?: string }).name ?? '')) {
      throw new Error('That code is not right. Check the latest email and try again.');
    }
    throw error;
  }
}

export async function signOut(): Promise<void> {
  if (isAmplifyConfigured()) await cognitoSignOut();
  currentUser = null;
}

export function validateNewPassword(password: string, confirmation: string): void {
  if (password.length < 12 || password.length > 128 || /\s/.test(password) ||
      !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
    throw new Error('Use 12–128 characters with uppercase, lowercase, a number and a symbol, without spaces.');
  }
  if (password !== confirmation) throw new Error('The passwords do not match.');
}

/** Ask Cognito, rather than local storage, whether the verified account has a password. */
export async function hasAccountPassword(): Promise<boolean> {
  requireAmplify();
  requireUser();
  const accessToken = (await fetchAuthSession()).tokens?.accessToken?.toString();
  const poolId = Amplify.getConfig().Auth?.Cognito.userPoolId;
  if (!accessToken || !poolId) throw new Error('Sign in again to check your password setup.');
  try {
    const factors = await new CognitoIdentityProviderClient({ region: poolId.split('_')[0] }).send(new GetUserAuthFactorsCommand({ AccessToken: accessToken }));
    if (!factors.ConfiguredUserAuthFactors) throw new Error('Authentication factors unavailable.');
    return factors.ConfiguredUserAuthFactors.includes('PASSWORD');
  } catch {
    throw new Error('Could not check your password setup. Try signing in with your existing password.');
  }
}

/** Cognito permits an initial password without PreviousPassword only for passwordless users. */
export async function createAccountPassword(password: string, confirmation: string): Promise<AuthUser> {
  validateNewPassword(password, confirmation);
  requireAmplify();
  const user = requireUser();
  const accessToken = (await fetchAuthSession()).tokens?.accessToken?.toString();
  const poolId = Amplify.getConfig().Auth?.Cognito.userPoolId;
  if (!accessToken || !poolId) throw new Error('Sign in again to create your password.');
  try {
    await new CognitoIdentityProviderClient({ region: poolId.split('_')[0] }).send(new ChangePasswordCommand({ AccessToken: accessToken, ProposedPassword: password }));
    return user;
  } catch (error) {
    const failure = error as { name?: string; message?: string };
    if (failure.name === 'InvalidParameterException' && /OldPassword|PreviousPassword/i.test(failure.message ?? '')) {
      throw new Error('Your password is already set. Continue to the workspace, then use Sign in with password next time.');
    }
    if (failure.name === 'NotAuthorizedException') throw new Error('Sign in again before creating your password.');
    throw new Error('Could not create your password. Try again or continue with email-code sign-in.');
  }
}

export async function signInWithPassword(email: string, password: string): Promise<AuthUser> {
  if (!isValidEmail(email)) throw new Error('Enter a valid work email.');
  if (!password) throw new Error('Enter your password.');
  requireAmplify();
  try {
    let result = await cognitoSignIn({ username: email.trim().toLowerCase(), password,
      options: { authFlowType: 'USER_AUTH', preferredChallenge: 'PASSWORD' } });
    if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_PASSWORD') {
      result = await confirmCognitoSignIn({ challengeResponse: password });
    }
    if (result.nextStep.signInStep !== 'DONE') throw new Error('Use email-code sign-in to finish verifying this account.');
    return await loadUser();
  } catch (error) {
    if (['NotAuthorizedException', 'UserNotFoundException'].includes((error as { name?: string }).name ?? '')) {
      throw new Error('Email or password is incorrect. Try again or use an email code.');
    }
    throw error;
  }
}
