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
  await user.type(screen.getByLabelText('Title *'), 'Signed document download fails');
  await user.type(screen.getByLabelText('Description *'), 'Download fails for signed document');
}
it('focuses the first missing field and associates errors', async () => {
  const { user } = mount(); await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
  expect(screen.getByLabelText('Title *')).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent('Please add a title, describe your feedback, choose a priority, choose or name a category.');
  expect(screen.getByLabelText('Description *')).toHaveAttribute('aria-invalid', 'true');
});
it('requires Other name, autosaves, adds/removes several files, and clears only on success', async () => {
  const { user, api, onSubmitted } = mount(); await fill(user);
  await user.selectOptions(screen.getByLabelText('Category *'), 'Other');
  await user.click(screen.getByRole('button', { name: 'Submit feedback' })); expect(screen.getByLabelText('Name the category *')).toHaveFocus();
  await user.type(screen.getByLabelText('Name the category *'), 'Alerts');
  expect(localStorage.getItem(draftKey('client-a'))).toContain('Alerts');
  const input = screen.getByLabelText(/Screenshots or recordings/);
  await user.upload(input, new File(['one'], 'one.png', { type: 'image/png' })); expect(screen.getByText('one.png')).toBeInTheDocument();
  expect(screen.getByText('Choose files')).toBeVisible();
  await user.upload(input, [new File(['two'], 'two.png', { type: 'image/png' }), new File(['three'], 'three.webm', { type: 'video/webm' })]);
  expect(screen.getByText('one.png')).toBeInTheDocument(); expect(screen.getByText('two.png')).toBeInTheDocument(); expect(screen.getByText('three.webm')).toBeInTheDocument();
  expect(screen.getByText('3 of 5')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Remove two.png' })); expect(screen.queryByText('two.png')).not.toBeInTheDocument();
  await user.upload(input, ['a', 'b', 'c', 'd'].map(name => new File([name], `${name}.png`, { type: 'image/png' })));
  expect(screen.getByText('5 of 5')).toBeInTheDocument(); expect(screen.queryByText('d.png')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('up to 5 files');
  expect(screen.getByRole('button', { name: 'Record screen now' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
  await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
  expect(api.uploadAttachment).toHaveBeenCalledTimes(5); expect(localStorage.getItem(draftKey('client-a'))).toBeNull(); expect(screen.getByLabelText('Description *')).toHaveValue('');
  expect(screen.queryByText('one.png')).not.toBeInTheDocument();
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
  expect(screen.getByText('Saved draft restored')).toBeInTheDocument(); expect(screen.getByText('Files are not saved with drafts. Attach your files again.')).toBeInTheDocument();
  await user.click(await screen.findByRole('button', { name: /FB-ABCD/ })); expect(onOpenReport).toHaveBeenCalledWith('report-abcd');
});
it('refuses invalid files from drop and accepts pasted files', async () => {
  const { user } = mount();
  const drop = screen.getByText('Choose files').closest('.client-drop')!;
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


it('lets the client type the title and keeps it in the saved draft', async () => {
  const { user } = mount();
  await user.type(screen.getByLabelText('Title *'), 'Export button does nothing');
  expect(screen.getByLabelText('Title *')).toHaveValue('Export button does nothing');
  expect(localStorage.getItem(draftKey('client-a'))).toContain('Export button does nothing');
});

it('counts title characters against the limit', async () => {
  const { user } = mount();
  expect(screen.getByText('0 / 60')).toBeInTheDocument();
  await user.type(screen.getByLabelText('Title *'), 'Export fails');
  expect(screen.getByText('12 / 60')).toBeInTheDocument();
  expect(screen.getByLabelText('Title *')).toHaveAttribute('maxLength', '60');
});
