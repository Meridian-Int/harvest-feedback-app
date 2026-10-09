import { beforeEach, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { AppRoutes } from '../../app/routes';
import { renderWithProviders } from '../../test/render';
import { makeClientUser, makeFeedback } from '../../test/factories';
import { mockFeedbackApi } from '../../test/mockFeedbackApi';
import { clientApi, clientChoices } from './foundation';

vi.mock('../../lib/feedback', async () => ({ ...(await import('../../test/mockFeedbackApi')).mockFeedbackApi, removeAttachment: vi.fn(), subscribeMyFeedback: vi.fn(() => () => {}) }));
beforeEach(() => {
  mockFeedbackApi.listMyFeedback.mockResolvedValue([]);
  mockFeedbackApi.createFeedback.mockResolvedValue(makeFeedback());
});

it('connects the authenticated form, shared options, API and success navigation', async () => {
  const { user } = renderWithProviders(<AppRoutes />, { route: '/feedback/new', user: makeClientUser() });
  await user.selectOptions(screen.getByLabelText('Product area *'), 'Other — add an area');
  await user.type(screen.getByLabelText('Name the area *'), 'Account settings');
  await user.selectOptions(screen.getByLabelText('Priority *'), 'BLOCKER');
  await user.selectOptions(screen.getByLabelText('Severity *'), 'CRITICAL');
  fireEvent.change(screen.getByLabelText('Description *'), { target: { value: 'Cannot open account settings' } });
  await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
  await screen.findByRole('heading', { name: 'My reports' });
  expect(mockFeedbackApi.createFeedback).toHaveBeenCalledWith({ description: 'Cannot open account settings', productArea: 'Other — add an area', customArea: 'Account settings', priority: 'BLOCKER', severity: 'CRITICAL' });
  expect(screen.getByText('Feedback submitted. You can track it in My reports.')).toBeInTheDocument();
});

it('uses the foundation title and identity derivation rather than forwarding caller fields', async () => {
  await clientApi.createFeedback({ title: 'ignored', description: 'Actual title', customArea: '', productArea: 'Data room', priority: 'BUG', severity: 'LOW' });
  expect(mockFeedbackApi.createFeedback.mock.calls.at(-1)?.[0]).not.toHaveProperty('title');
  expect(clientChoices.productAreas).toHaveLength(10);
});
