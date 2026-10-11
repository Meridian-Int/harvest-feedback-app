import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { NewFeedbackForm as NewFeedbackPage } from './NewFeedbackForm';
import { choices, controls, makeApi, makeReport } from './testing/support';
import { draftKey } from './logic/draft';

function mount(api = makeApi()) {
  const onSubmitted = vi.fn(), onOpenReport = vi.fn();
  render(<NewFeedbackPage api={api} choices={choices} controls={controls} draftScope="client-a" onSubmitted={onSubmitted} onOpenReport={onOpenReport} />);
  return { api, onSubmitted, onOpenReport, user: userEvent.setup() };
}
async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Category *'), 'Data room');
  await user.selectOptions(screen.getByLabelText('Priority *'), 'BUG');
  await user.type(screen.getByLabelText('Description *'), 'Download fails for signed document');
}
it('focuses the first missing field and associates errors', async () => {
  const { user } = mount(); await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
  expect(screen.getByLabelText('Description *')).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent('Please describe your feedback, choose a priority, choose or name a category.');
  expect(screen.getByLabelText('Description *')).toHaveAttribute('aria-invalid', 'true');
});
it('requires Other name, autosaves, replaces/removes files, and clears only on success', async () => {
  const { user, api, onSubmitted } = mount(); await fill(user);
  await user.selectOptions(screen.getByLabelText('Category *'), 'Other');
  await user.click(screen.getByRole('button', { name: 'Submit feedback' })); expect(screen.getByLabelText('Name the category *')).toHaveFocus();
  await user.type(screen.getByLabelText('Name the category *'), 'Alerts');
  expect(localStorage.getItem(draftKey('client-a'))).toContain('Alerts');
  const input = screen.getByLabelText(/Screenshot or recording/);
  await user.upload(input, new File(['one'], 'one.png', { type: 'image/png' })); expect(screen.getByText('one.png')).toBeInTheDocument();
  expect(screen.getByText('Choose a file')).toBeVisible();
  await user.upload(input, new File(['two'], 'two.png', { type: 'image/png' }));
  expect(screen.getByText('one.png')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Submit feedback' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Keep current attachment' }));
  expect(screen.getByText('one.png')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Replace attachment' })).not.toBeInTheDocument();
  await user.upload(input, new File(['two'], 'two.png', { type: 'image/png' }));
  await user.click(screen.getByRole('button', { name: 'Replace attachment' }));
  expect(screen.queryByText('one.png')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Remove attachment' })); expect(screen.queryByText('two.png')).not.toBeInTheDocument();
  await user.upload(input, new File(['three'], 'three.png', { type: 'image/png' }));
  await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
  await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
  expect(api.uploadAttachment).toHaveBeenCalledTimes(1); expect(localStorage.getItem(draftKey('client-a'))).toBeNull(); expect(screen.getByLabelText('Description *')).toHaveValue('');
});
it('blocks double submission and preserves form/draft when create fails', async () => {
  const api = makeApi(); let reject!: (error: Error) => void;
  vi.mocked(api.createFeedback).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  const { user, onSubmitted } = mount(api); await fill(user);
  await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
  expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
  fireEvent.submit(screen.getByRole('button', { name: 'Submitting…' }).closest('form')!);
  expect(api.createFeedback).toHaveBeenCalledTimes(1);
  reject(Error('failed')); await screen.findByRole('alert');
  expect(onSubmitted).not.toHaveBeenCalled(); expect(screen.getByLabelText('Description *')).toHaveValue('Download fails for signed document'); expect(localStorage.getItem(draftKey('client-a'))).toContain('Download fails');
});
it('restores without media and opens an owner-list duplicate', async () => {
  localStorage.setItem(draftKey('client-a'), JSON.stringify({ version: 1, fields: { productArea: 'Data room', priority: 'BUG', severity: 'LOW', description: 'Download fails for signed document' } }));
  const api = makeApi(); vi.mocked(api.listMyFeedback).mockResolvedValue([makeReport()]);
  const { user, onOpenReport } = mount(api);
  expect(screen.getByText('Saved draft restored')).toBeInTheDocument(); expect(screen.getByText('Files are not saved with drafts. Attach your file again.')).toBeInTheDocument();
  await user.click(await screen.findByRole('button', { name: /FB-ABCD/ })); expect(onOpenReport).toHaveBeenCalledWith('report-abcd');
});
it('refuses invalid files from drop and accepts pasted files', async () => {
  const { user } = mount();
  const drop = screen.getByText('Choose a file').closest('.client-drop')!;
  fireEvent.drop(drop, { dataTransfer: { files: [new File(['bad'], 'bad.txt', { type: 'text/plain' })] } });
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a PNG');
  fireEvent.paste(screen.getByLabelText('Description *'), { clipboardData: { files: [new File(['ok'], 'paste.png', { type: 'image/png' })] } });
  expect(screen.getByText('paste.png')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Record screen now' })); expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('uses a single priority selector and derives severity for the existing API', async () => {
  const { user, api } = mount();
  expect(screen.queryByLabelText('Severity *')).not.toBeInTheDocument();
  await fill(user);
  await user.selectOptions(screen.getByLabelText('Priority *'), 'BLOCKER');
  expect(screen.getByText('Blocker: you cannot continue.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
  await waitFor(() => expect(api.createFeedback).toHaveBeenCalledWith(expect.objectContaining({ priority: 'BLOCKER', severity: 'CRITICAL' })));
});
