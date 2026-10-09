import { screen } from '@testing-library/react';
import { AppRoutes } from './routes';
import { renderWithProviders } from '../test/render';
import { vi } from 'vitest';

const auth = vi.hoisted(() => ({ signIn: vi.fn(), confirmSignIn: vi.fn(), createAccountPassword: vi.fn(), hasAccountPassword: vi.fn(), signInWithPassword: vi.fn() }));
vi.mock('../lib/auth', async importOriginal => ({ ...(await importOriginal<typeof import('../lib/auth')>()), ...auth }));

beforeEach(() => {
  auth.hasAccountPassword.mockReset().mockResolvedValue(false);
  auth.signIn.mockReset().mockImplementation(async (email: string) => { if (email === 'bad') throw new Error('Enter a valid work email.'); });
  auth.confirmSignIn.mockReset().mockImplementation(async (code: string) => {
    if (!/^[0-9]{8}$/.test(code)) throw new Error('Enter an 8-digit verification code.');
    if (code !== '12345678') throw new Error('That code is not right. Check the latest email and try again.');
    return { id: 'user-1', email: 'company@example.com', name: 'Company', persona: 'Company', company: 'Northstar', groups: [] };
  });
});

it('offers password creation only after client email verification and keeps errors on the setup screen', async () => {
  const verified = { id: 'user-1', email: 'company@example.com', name: 'Company', persona: 'Company', company: 'Northstar', groups: [] };
  auth.createAccountPassword.mockReset().mockRejectedValueOnce(new Error('The passwords do not match.')).mockResolvedValueOnce(verified);
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null });
  await user.type(screen.getByLabelText('Work email'), 'company@example.com');
  await user.click(screen.getByRole('button', { name: 'Continue with email' }));
  await user.type(screen.getByLabelText('Verification code'), '65432187');
  auth.confirmSignIn.mockResolvedValueOnce(verified);
  await user.click(screen.getByRole('button', { name: 'Open workspace' }));
  expect(screen.getByRole('heading', { name: 'Create your password' })).toBeInTheDocument();
  await user.type(screen.getByLabelText('Create password'), 'Test-password-2468!');
  await user.type(screen.getByLabelText('Confirm password'), 'different');
  await user.click(screen.getByRole('button', { name: 'Save password and continue' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('do not match');
  await user.clear(screen.getByLabelText('Confirm password'));
  await user.type(screen.getByLabelText('Confirm password'), 'Test-password-2468!');
  await user.click(screen.getByRole('button', { name: 'Save password and continue' }));
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
});

it('supports password sign-in without requesting a code and can return to email sign-in', async () => {
  auth.signInWithPassword.mockReset().mockRejectedValueOnce(new Error('Email or password is incorrect.'));
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null });
  await user.click(screen.getByRole('button', { name: 'Sign in with password' }));
  await user.type(screen.getByLabelText('Work email'), 'company@example.com');
  await user.type(screen.getByLabelText('Password'), 'wrong');
  await user.click(screen.getByRole('button', { name: /^Sign in$/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('incorrect');
  expect(auth.signIn).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Use an email code instead' }));
  expect(screen.getByRole('button', { name: 'Continue with email' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
});

it('shows invalid email errors inside the card and focuses the email input', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null }); await user.type(screen.getByLabelText('Work email'), 'bad'); await user.click(screen.getByRole('button', { name: 'Continue with email' })); expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid work email.'); expect(screen.getByLabelText('Work email')).toHaveFocus(); expect(screen.getByRole('alert').closest('.auth-card')).not.toBeNull();
});
it('requires eight digits, displays a wrong-code error, and supports switching email', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null }); await user.type(screen.getByLabelText('Work email'), 'company@example.com'); await user.click(screen.getByRole('button', { name: 'Continue with email' }));
  expect(screen.getByLabelText('Verification code')).toHaveFocus(); await user.type(screen.getByLabelText('Verification code'), '123'); await user.click(screen.getByRole('button', { name: 'Open workspace' })); expect(await screen.findByRole('alert')).toHaveTextContent('8-digit');
  await user.clear(screen.getByLabelText('Verification code')); await user.type(screen.getByLabelText('Verification code'), '00000000'); await user.click(screen.getByRole('button', { name: 'Open workspace' })); expect(await screen.findByRole('alert')).toHaveTextContent('That code is not right.');
  await user.click(screen.getByRole('button', { name: 'Use a different email' })); expect(screen.getByRole('heading', { name: 'Sign in to Harvest' })).toBeInTheDocument(); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.getByLabelText('Work email')).toHaveValue('company@example.com');
});
it.each([['company@example.com', 'Share your feedback'], ['admin@example.com', 'Feedback review'], ['operator@example.com', 'Share your feedback']])('signs %s into the correct workspace', async (email, heading) => {
  auth.confirmSignIn.mockImplementationOnce(async () => ({ id: 'user-1', email, name: 'User', persona: 'Operator', company: 'Meridian', groups: email === 'admin@example.com' ? ['admins'] : [] }));
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null }); expect(screen.queryByText(/Development only/)).not.toBeInTheDocument(); await user.type(screen.getByLabelText('Work email'), email); await user.click(screen.getByRole('button', { name: 'Continue with email' })); await user.type(screen.getByLabelText('Verification code'), '12345678'); await user.click(screen.getByRole('button', { name: 'Open workspace' })); if (email === 'admin@example.com') { auth.createAccountPassword.mockResolvedValueOnce({ id: 'user-1', email, name: 'Admin', persona: 'Operator', company: 'Meridian', groups: ['admins'] }); await user.type(await screen.findByLabelText('Create password'), 'Test-password-2468!'); await user.type(screen.getByLabelText('Confirm password'), 'Test-password-2468!'); await user.click(screen.getByRole('button', { name: 'Save password and continue' })); } else await user.click(await screen.findByRole('button', { name: 'Continue without creating a password' })); expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
});

it('skips password creation after code login when Cognito says a password already exists', async () => {
  auth.hasAccountPassword.mockResolvedValueOnce(true);
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null });
  await user.type(screen.getByLabelText('Work email'), 'company@example.com');
  await user.click(screen.getByRole('button', { name: 'Continue with email' }));
  await user.type(screen.getByLabelText('Verification code'), '12345678');
  await user.click(screen.getByRole('button', { name: 'Open workspace' }));
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Create password')).not.toBeInTheDocument();
});
