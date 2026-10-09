import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import { AppRoutes } from './routes';
import { renderWithProviders } from '../test/render';
import { makeClientUser } from '../test/factories';

vi.mock('../lib/feedback', () => ({ listMyFeedback: vi.fn().mockResolvedValue([]), subscribeMyFeedback: vi.fn(() => () => {}) }));

it.each(['/account/setup', '/feedback/new'])('opens feedback without the disabled account type setup at %s', async route => {
  renderWithProviders(<AppRoutes />, { route, user: makeClientUser({ needsPersonaSetup: true }) });
  expect(await screen.findByRole('heading', { name: 'Share your feedback' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Account type')).not.toBeInTheDocument();
});
