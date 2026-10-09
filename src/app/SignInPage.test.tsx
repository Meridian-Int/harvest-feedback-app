import { screen } from '@testing-library/react';
import { AppRoutes } from './routes';
import { renderWithProviders } from '../test/render';
import { vi } from 'vitest';

const auth = vi.hoisted(() => ({ signIn: vi.fn(), confirmSignIn: vi.fn() }));
vi.mock('../lib/auth', async importOriginal => ({ ...(await importOriginal<typeof import('../lib/auth')>()), ...auth }));

beforeEach(() => {
  auth.signIn.mockReset().mockImplementation(async (email: string) => { if (email === 'bad') throw new Error('Enter a valid work email.'); });
  auth.confirmSignIn.mockReset().mockImplementation(async (code: string) => {
    if (!/^[0-9]{6}$/.test(code)) throw new Error('Enter a 6-digit verification code.');
    if (code !== '123456') throw new Error('That code is not right. Check the latest email and try again.');
    return { id: 'user-1', email: 'company@example.com', name: 'Company', persona: 'Company', company: 'Northstar', groups: [] };
  });
});

it('shows invalid email errors inside the card and focuses the email input', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null }); await user.type(screen.getByLabelText('Work email'), 'bad'); await user.click(screen.getByRole('button', { name: 'Continue with email' })); expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid work email.'); expect(screen.getByLabelText('Work email')).toHaveFocus(); expect(screen.getByRole('alert').closest('.auth-card')).not.toBeNull();
});
it('requires six digits, displays a wrong-code error, and supports switching email', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null }); await user.type(screen.getByLabelText('Work email'), 'company@example.com'); await user.click(screen.getByRole('button', { name: 'Continue with email' }));
  expect(screen.getByLabelText('Verification code')).toHaveFocus(); await user.type(screen.getByLabelText('Verification code'), '123'); await user.click(screen.getByRole('button', { name: 'Open workspace' })); expect(await screen.findByRole('alert')).toHaveTextContent('6-digit');
  await user.clear(screen.getByLabelText('Verification code')); await user.type(screen.getByLabelText('Verification code'), '000000'); await user.click(screen.getByRole('button', { name: 'Open workspace' })); expect(await screen.findByRole('alert')).toHaveTextContent('That code is not right.');
  await user.click(screen.getByRole('button', { name: 'Use a different email' })); expect(screen.getByRole('heading', { name: 'Sign in to Harvest' })).toBeInTheDocument(); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.getByLabelText('Work email')).toHaveValue('company@example.com');
});
it.each([['company@example.com', 'Share your feedback'], ['admin@example.com', 'Feedback review'], ['operator@example.com', 'Share your feedback']])('signs %s into the correct workspace', async (email, heading) => {
  auth.confirmSignIn.mockImplementationOnce(async () => ({ id: 'user-1', email, name: 'User', persona: 'Operator', company: 'Meridian', groups: email === 'admin@example.com' ? ['admins'] : [] }));
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null }); expect(screen.queryByText(/Development only/)).not.toBeInTheDocument(); await user.type(screen.getByLabelText('Work email'), email); await user.click(screen.getByRole('button', { name: 'Continue with email' })); await user.type(screen.getByLabelText('Verification code'), '123456'); await user.click(screen.getByRole('button', { name: 'Open workspace' })); expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
});
