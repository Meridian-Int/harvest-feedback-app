import { screen } from '@testing-library/react';
import { AppRoutes } from './routes';
import { renderWithProviders } from '../test/render';

it('shows invalid email errors inside the card and focuses the email input', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null }); await user.type(screen.getByLabelText('Work email'), 'bad'); await user.click(screen.getByRole('button', { name: 'Continue with email' })); expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid work email.'); expect(screen.getByLabelText('Work email')).toHaveFocus(); expect(screen.getByRole('alert').closest('.auth-card')).not.toBeNull();
});
it('requires six digits, displays a wrong-code error, and supports switching email', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null }); await user.type(screen.getByLabelText('Work email'), 'company@example.com'); await user.click(screen.getByRole('button', { name: 'Continue with email' }));
  expect(screen.getByLabelText('Verification code')).toHaveFocus(); await user.type(screen.getByLabelText('Verification code'), '123'); await user.click(screen.getByRole('button', { name: 'Open workspace' })); expect(await screen.findByRole('alert')).toHaveTextContent('6-digit');
  await user.clear(screen.getByLabelText('Verification code')); await user.type(screen.getByLabelText('Verification code'), '000000'); await user.click(screen.getByRole('button', { name: 'Open workspace' })); expect(await screen.findByRole('alert')).toHaveTextContent('Use 123456');
  await user.click(screen.getByRole('button', { name: 'Use a different email' })); expect(screen.getByRole('heading', { name: 'Sign in to Harvest' })).toBeInTheDocument(); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.getByLabelText('Work email')).toHaveValue('company@example.com');
});
it.each([['company@example.com', 'Share your feedback'], ['admin@example.com', 'Feedback review'], ['operator@example.com', 'Share your feedback']])('signs %s into the correct workspace', async (email, heading) => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/sign-in', user: null }); expect(screen.getByText(/Development only/)).toBeInTheDocument(); await user.type(screen.getByLabelText('Work email'), email); await user.click(screen.getByRole('button', { name: 'Continue with email' })); await user.type(screen.getByLabelText('Verification code'), '123456'); await user.click(screen.getByRole('button', { name: 'Open workspace' })); expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
});
