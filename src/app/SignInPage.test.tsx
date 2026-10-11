import { screen } from '@testing-library/react';
import { AppRoutes } from './routes';
import { renderWithProviders } from '../test/render';
import { vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());

const auth = vi.hoisted(() => ({ signIn: vi.fn(), confirmSignIn: vi.fn(), createAccountPassword: vi.fn(), hasAccountPassword: vi.fn(), beginAccountSignIn: vi.fn(), finishAccountPasswordSignIn: vi.fn(), requestAccountPasswordSetup: vi.fn(), completeAccountPasswordSetup: vi.fn() }));
vi.mock('../lib/auth', async original => ({ ...(await original<typeof import('../lib/auth')>()), ...auth }));
const verified = { id: 'user-1', email: 'company@example.com', name: 'Company', persona: 'Company', company: 'Northstar', groups: [] };
beforeEach(() => {
  for (const mock of Object.values(auth)) mock.mockReset();
  auth.createAccountPassword.mockResolvedValue(verified);
  auth.signIn.mockResolvedValue(undefined);
  auth.beginAccountSignIn.mockResolvedValue('password');
  auth.finishAccountPasswordSignIn.mockResolvedValue(verified);
  auth.confirmSignIn.mockResolvedValue(verified);
  auth.hasAccountPassword.mockResolvedValue(false);
});

it('defaults to password sign-in and does not send a code', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null });
  await user.type(screen.getByLabelText('Work email'), 'company@example.com');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(await screen.findByLabelText('Password'), 'Test-password-2468!');
  await user.click(screen.getByRole('button', { name: /^Sign in$/ }));
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
  expect(auth.beginAccountSignIn).toHaveBeenCalledWith('company@example.com');
  expect(auth.finishAccountPasswordSignIn).toHaveBeenCalledWith('Test-password-2468!', 'company@example.com');
  expect(auth.confirmSignIn).not.toHaveBeenCalled();
  expect(auth.signIn).not.toHaveBeenCalled();
});

it('does not offer email-code sign-in against HARVEST staging', async () => {
  vi.stubEnv('VITE_HARVEST_AUTH_MODE', 'staging');
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null });
  await user.type(screen.getByLabelText('Work email'), 'company@example.com');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByLabelText('Password')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Use an email code instead' })).not.toBeInTheDocument();
});

it('offers no public account creation, setup or code login actions', () => {
  renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null });
  expect(screen.queryByRole('button', { name: /Create an account|Set up an existing account|email code/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
});

it('keeps bad-password errors on the login page without requesting a code', async () => {
  auth.finishAccountPasswordSignIn.mockRejectedValueOnce(new Error('Email or password is incorrect.'));
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null });
  await user.type(screen.getByLabelText('Work email'), 'company@example.com');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(await screen.findByLabelText('Password'), 'wrong');
  await user.click(screen.getByRole('button', { name: /^Sign in$/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('incorrect');
  expect(auth.signIn).not.toHaveBeenCalled();
});

it('lets a restored email-code session open reports without a password', async () => {
  renderWithProviders(<AppRoutes />, { route: '/feedback/new', user: { ...verified, persona: 'Company', needsPasswordSetup: true } });
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
});

it('offers password setup after first-time email verification', async () => {
  auth.beginAccountSignIn.mockResolvedValueOnce('code');
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null });
  await user.type(screen.getByLabelText('Work email'), 'company@example.com');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(await screen.findByLabelText('Verification code'), '12345678');
  await user.click(screen.getByRole('button', { name: 'Verify email' }));
  await user.type(await screen.findByLabelText('Create password'), 'Test-password-2468!');
  expect(screen.queryByRole('heading', { name: 'Share your feedback' })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Confirm password'), 'Test-password-2468!');
  await user.click(screen.getByRole('button', { name: 'Save password and continue' }));
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
  expect(auth.confirmSignIn).toHaveBeenCalledWith('12345678');
  expect(auth.createAccountPassword).toHaveBeenCalledWith('Test-password-2468!', 'Test-password-2468!');
  expect(auth.finishAccountPasswordSignIn).not.toHaveBeenCalled();
});

it('allows a verified user to continue with an email code without setting a password', async () => {
  auth.beginAccountSignIn.mockResolvedValueOnce('code');
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null });
  await user.type(screen.getByLabelText('Work email'), 'company@example.com');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(await screen.findByLabelText('Verification code'), '12345678');
  await user.click(screen.getByRole('button', { name: 'Verify email' }));
  await user.click(await screen.findByRole('button', { name: 'Continue with email code only' }));
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
  expect(auth.createAccountPassword).not.toHaveBeenCalled();
});

it('does not reject a verified email-code session when password-factor lookup fails', async () => {
  auth.beginAccountSignIn.mockResolvedValueOnce('code');
  auth.hasAccountPassword.mockRejectedValueOnce(new Error('factor lookup unavailable'));
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null });
  await user.type(screen.getByLabelText('Work email'), 'company@example.com');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(await screen.findByLabelText('Verification code'), '12345678');
  await user.click(screen.getByRole('button', { name: 'Verify email' }));
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
});

it('lets a returning password user choose email-code sign-in', async () => {
  auth.hasAccountPassword.mockResolvedValueOnce(true);
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null });
  await user.type(screen.getByLabelText('Work email'), 'company@example.com');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(await screen.findByRole('button', { name: 'Use an email code instead' }));
  expect(auth.signIn).toHaveBeenCalledWith('company@example.com');
  await user.type(await screen.findByLabelText('Verification code'), '12345678');
  await user.click(screen.getByRole('button', { name: 'Verify email' }));
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
});

it('lets a provisioned user verify their inbox and set an unknown password', async () => {
  auth.requestAccountPasswordSetup.mockResolvedValue(undefined);
  auth.completeAccountPasswordSetup.mockResolvedValue(verified);
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null });
  await user.type(screen.getByLabelText('Work email'), 'company@example.com');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(await screen.findByRole('button', { name: 'Set or reset password' }));
  await user.type(await screen.findByLabelText('Verification code'), '123456');
  await user.type(screen.getByLabelText('Create password'), 'Test-password-2468!');
  await user.type(screen.getByLabelText('Confirm password'), 'Test-password-2468!');
  await user.click(screen.getByRole('button', { name: 'Save password and continue' }));
  expect(auth.completeAccountPasswordSetup).toHaveBeenCalledWith('company@example.com', '123456', 'Test-password-2468!', 'Test-password-2468!');
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
});
