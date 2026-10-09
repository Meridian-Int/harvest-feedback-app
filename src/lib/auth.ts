import type { AuthUser } from './types';

/** DEVELOPMENT ONLY: simulated OTP, no email delivery. Replace this adapter with Cognito. */
export const MOCK_AUTH = true;
const SESSION_KEY = 'harvest-mock-session';
const CHALLENGE_KEY = 'harvest-mock-challenge';

export function isValidEmail(email: string): boolean {
  return email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function userForEmail(email: string): AuthUser {
  const admin = email === 'admin@example.com';
  const persona = email === 'partner@example.com' ? 'Partner' : email === 'operator@example.com' || admin ? 'Operator' : 'Company';
  const name = email.split('@')[0].replace(/[._+-]+/g, ' ').trim().replace(/\b[a-z]/g, c => c.toUpperCase());
  return { id: email, email, name: admin ? 'Admin' : name, persona,
    company: persona === 'Partner' ? 'Meridian Partner' : persona === 'Operator' ? 'Meridian Operations' : email === 'company@example.com' ? 'Northstar Company' : 'Client workspace',
    groups: admin ? ['admins'] : [] };
}

export function getCurrentUser(): AuthUser | null {
  const email = sessionStorage.getItem(SESSION_KEY);
  return email && isValidEmail(email) ? userForEmail(email) : null;
}

export function isAdmin(user: AuthUser | null): boolean {
  return Boolean(user?.groups.includes('admins'));
}

export function requireUser(): AuthUser {
  const user = getCurrentUser();
  if (!user) throw new Error('Sign in to Harvest');
  return user;
}

export async function signIn(email: string): Promise<void> {
  if (!isValidEmail(email)) throw new Error('Enter a valid work email.');
  sessionStorage.setItem(CHALLENGE_KEY, email.trim().toLowerCase());
}

export async function confirmSignIn(code: string): Promise<AuthUser> {
  if (!/^[0-9]{6}$/.test(code)) throw new Error('Enter a 6-digit verification code.');
  if (code !== '123456') throw new Error('Use 123456 to try this local demo.');
  const email = sessionStorage.getItem(CHALLENGE_KEY);
  if (!email) throw new Error('Enter a valid work email.');
  sessionStorage.setItem(SESSION_KEY, email);
  sessionStorage.removeItem(CHALLENGE_KEY);
  return userForEmail(email);
}

export async function signOut(): Promise<void> {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(CHALLENGE_KEY);
}
