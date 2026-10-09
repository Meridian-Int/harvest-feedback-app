import { confirmSignIn, getCurrentUser, isAdmin, isValidEmail, requireUser, signIn, signOut } from './auth';

it('validates email and normalizes the challenge email', async () => {
  expect(isValidEmail('bad')).toBe(false); expect(isValidEmail('a'.repeat(255) + '@x.com')).toBe(false);
  await expect(signIn('bad')).rejects.toThrow('Enter a valid work email.');
  await signIn('  ADMIN@EXAMPLE.COM  '); const user = await confirmSignIn('123456');
  expect(user.email).toBe('admin@example.com'); expect(isAdmin(user)).toBe(true); expect(user.name).toBe('Admin');
});
it('requires a challenge and exactly six digits before accepting the mock code', async () => {
  await expect(confirmSignIn('123')).rejects.toThrow('6-digit'); await expect(confirmSignIn('abcdef')).rejects.toThrow('6-digit');
  await expect(confirmSignIn('000000')).rejects.toThrow('Use 123456'); await expect(confirmSignIn('123456')).rejects.toThrow('valid work email');
});
it.each(['company@example.com', 'partner@example.com', 'operator@example.com', 'someone+else@company.com'])('treats %s as a client, persists the session and signs out', async email => {
  await signIn(email); const user = await confirmSignIn('123456'); expect(isAdmin(user)).toBe(false);
  expect(getCurrentUser()).toEqual(user); expect(requireUser()).toEqual(user);
  await signOut(); expect(getCurrentUser()).toBeNull(); expect(isAdmin(null)).toBe(false); expect(() => requireUser()).toThrow('Sign in');
});
it('ignores a malformed stored session', () => { sessionStorage.setItem('harvest-mock-session', 'broken'); expect(getCurrentUser()).toBeNull(); });
