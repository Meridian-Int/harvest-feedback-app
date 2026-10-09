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
  const persona = attributes['custom:persona'];
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
  if (!/^[0-9]{6}$/.test(code)) throw new Error('Enter a 6-digit verification code.');
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
