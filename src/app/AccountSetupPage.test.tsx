import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import { AppRoutes } from './routes';
import { renderWithProviders } from '../test/render';
import { makeClientUser } from '../test/factories';

const auth = vi.hoisted(() => ({ hasAccountPassword: vi.fn(), createAccountPassword: vi.fn(), saveClientPersona: vi.fn() }));
vi.mock('../lib/auth', async original => ({ ...await original<typeof import('../lib/auth')>(), ...auth }));
vi.mock('../lib/feedback', () => ({ listMyFeedback: vi.fn().mockResolvedValue([]), subscribeMyFeedback: vi.fn(() => () => {}) }));
beforeEach(() => {
  vi.clearAllMocks();
  auth.hasAccountPassword.mockResolvedValue(true);
  auth.createAccountPassword.mockResolvedValue(makeClientUser());
  auth.saveClientPersona.mockResolvedValue(makeClientUser({ persona: 'Partner', needsPersonaSetup: false }));
});

it('requires account type once and never asks existing password users to create it again', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/feedback/new', user: makeClientUser({ needsPersonaSetup: true }) });
  expect(await screen.findByText('Your password is already set. Use Sign in with password next time.')).toBeInTheDocument();
  expect(screen.queryByLabelText('Create password')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save account and continue' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Choose Company or Partner');
  await user.selectOptions(screen.getByLabelText('Account type'), 'Partner');
  await user.click(screen.getByRole('button', { name: 'Save account and continue' }));
  expect(auth.saveClientPersona).toHaveBeenCalledWith('Partner');
  expect(auth.createAccountPassword).not.toHaveBeenCalled();
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Persona *')).not.toBeInTheDocument();
});

it('creates a password after verification and saves the account type before opening the form', async () => {
  auth.hasAccountPassword.mockResolvedValue(false);
  const { user } = renderWithProviders(<AppRoutes />, { route: '/account/setup', user: makeClientUser({ needsPersonaSetup: true }) });
  await screen.findByLabelText('Create password');
  await user.selectOptions(screen.getByLabelText('Account type'), 'Company');
  await user.type(screen.getByLabelText('Create password'), 'Test-password-2468!');
  await user.type(screen.getByLabelText('Confirm password'), 'Test-password-2468!');
  await user.click(screen.getByRole('button', { name: 'Save account and continue' }));
  expect(auth.createAccountPassword).toHaveBeenCalledWith('Test-password-2468!', 'Test-password-2468!');
  expect(auth.saveClientPersona).toHaveBeenCalledWith('Company');
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
});
