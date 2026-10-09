import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { renderWithProviders } from '../../test/render';
import { Button, Dialog, DropZone, EmptyState, Field, Input, MetricToggle, Pagination, Panel, Pill, ProgressTrack, SegmentedControl, Select, Tag, Textarea, ThemeToggle, Toast } from './index';

it('renders neutral priority/severity pills with their semantic dot values', () => {
  renderWithProviders(<><Pill value="BUG" /><Pill value="IMPROVEMENT" /><Pill value="BLOCKER" /><Pill value="CRITICAL" /><Pill value="MEDIUM" /><Pill value="LOW" /></>);
  for (const [text, value] of [['Bug', 'BUG'], ['Improvement', 'IMPROVEMENT'], ['Blocker', 'BLOCKER'], ['Critical', 'CRITICAL'], ['Medium', 'MEDIUM'], ['Low', 'LOW']]) {
    expect(screen.getByText(text)).toHaveAttribute('data-value', value); expect(screen.getByText(text).querySelector('.dot')).toBeInTheDocument();
  }
});
it('marks completed, current and future progress steps accessibly', () => {
  const { rerender } = renderWithProviders(<ProgressTrack status="ASSIGNED" compact />);
  let steps = screen.getAllByRole('listitem'); expect(steps[0]).toHaveClass('completed'); expect(steps[1]).toHaveAttribute('aria-current', 'step'); expect(steps[2]).toHaveClass('future');
  rerender(<ProgressTrack status="CLOSED" />); steps = screen.getAllByRole('listitem'); expect(steps.every(step => step.classList.contains('completed'))).toBe(true); expect(steps[3]).toHaveAttribute('aria-current', 'step');
});
it('disables pagination at boundaries and handles zero results', async () => {
  const change = vi.fn(); const { user, rerender } = renderWithProviders(<Pagination total={13} page={1} onPageChange={change} />);
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled(); await user.click(screen.getByRole('button', { name: 'Next' })); expect(change).toHaveBeenCalledWith(2);
  rerender(<Pagination total={13} page={3} onPageChange={change} />); expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled(); await user.click(screen.getByRole('button', { name: 'Previous' })); expect(change).toHaveBeenCalledWith(2);
  rerender(<Pagination total={0} page={9} onPageChange={change} />); expect(screen.getByText('0 reports')).toBeInTheDocument(); expect(screen.getByText('Page 1 of 1')).toBeInTheDocument(); expect(screen.getAllByRole('button').every(button => (button as HTMLButtonElement).disabled)).toBe(true);
});
it('closes a native modal with Done and the browser Escape cancel event', async () => {
  function Demo() { const [open, setOpen] = useState(true); return <><Button onClick={() => setOpen(true)}>Open</Button><Dialog open={open} onClose={() => setOpen(false)} title="Report">Description</Dialog></>; }
  const { user } = renderWithProviders(<Demo />); expect(screen.getByRole('dialog')).toHaveAttribute('open');
  await user.click(screen.getByRole('button', { name: 'Done' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Open' })); fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Open' })); await user.click(screen.getByRole('button', { name: 'Close report' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('updates segmented and metric button aria-pressed states', async () => {
  const onChange = vi.fn(); const onClick = vi.fn(); const { user } = renderWithProviders(<><SegmentedControl label="Report layout" value="list" compact options={[{ value: 'list', label: 'List' }, { value: 'grid', label: 'Grid' }]} onChange={onChange} /><MetricToggle label="Bugs" count={3} helper="Open bugs" selected onClick={onClick} /></>);
  expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true'); expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'false'); await user.click(screen.getByRole('button', { name: 'Grid' })); expect(onChange).toHaveBeenCalledWith('grid'); await user.click(screen.getByRole('button', { name: /Bugs/ })); expect(onClick).toHaveBeenCalledOnce();
});
it('toggles the document theme and persists the choice', async () => {
  const { user } = renderWithProviders(<ThemeToggle />); expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  await user.click(screen.getByRole('button', { name: 'Switch to light theme' })); expect(document.documentElement).toHaveAttribute('data-theme', 'light'); expect(localStorage.getItem('harvest-theme')).toBe('light'); expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
});
it('associates form labels, helper text and errors, and supports standard control props', () => {
  renderWithProviders(<Panel heading="New feedback" actions={<Tag>Admin</Tag>}><div className="panel-body"><Field label="Product area" htmlFor="area" required hint="Choose an area"><Select id="area" aria-describedby="area-hint"><option>Data room</option></Select></Field><Field label="Description" htmlFor="body" error="Required"><Textarea id="body" aria-invalid="true" /></Field><Field label="Work email" htmlFor="email" optional><Input id="email" /></Field><EmptyState>No reports</EmptyState></div></Panel>);
  expect(screen.getByLabelText('Product area *')).toHaveAccessibleDescription('Choose an area'); expect(screen.getByLabelText('Description')).toHaveAttribute('aria-invalid', 'true'); expect(screen.getByRole('alert')).toHaveTextContent('Required'); expect(screen.getByRole('heading', { name: 'New feedback' })).toBeInTheDocument();
});
it('auto-dismisses an announced toast after four seconds', () => {
  vi.useFakeTimers(); const dismiss = vi.fn(); const { rerender } = renderWithProviders(<Toast message="Saved" onDismiss={dismiss} />);
  expect(screen.getByRole('status')).toHaveTextContent('Saved'); act(() => vi.advanceTimersByTime(4000)); expect(dismiss).toHaveBeenCalledOnce(); rerender(<Toast message={null} onDismiss={dismiss} />); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('selects, previews and removes one attachment, revoking object URLs', async () => {
  const changed = vi.fn(); const file = new File(['png'], 'capture.png', { type: 'image/png' });
  const { user, rerender, unmount } = renderWithProviders(<DropZone file={null} onFileChange={changed} />);
  const input = document.querySelector('input[type=file]')!; await user.upload(input as HTMLInputElement, file); expect(changed).toHaveBeenCalledWith(file);
  rerender(<DropZone file={file} onFileChange={changed} />); expect(screen.getByRole('img', { name: 'Attachment preview' })).toHaveAttribute('src', 'blob:mock-media'); await user.click(screen.getByRole('button', { name: 'Remove attachment' })); expect(changed).toHaveBeenCalledWith(null);
  unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-media');
});
it('uses the first dropped file and ignores drops when disabled', () => {
  const changed = vi.fn(); const file = new File(['x'], 'recording.webm', { type: 'video/webm' });
  const { container, rerender } = renderWithProviders(<DropZone file={file} onFileChange={changed} />);
  const drop = container.querySelector('.drop')!; fireEvent.dragOver(drop); expect(drop).toHaveClass('drag'); fireEvent.drop(drop, { dataTransfer: { files: [file, file] } }); expect(changed).toHaveBeenCalledWith(file); expect(drop).not.toHaveClass('drag');
  changed.mockClear(); rerender(<DropZone disabled file={null} onFileChange={changed} />); fireEvent.drop(drop, { dataTransfer: { files: [file] } }); expect(changed).not.toHaveBeenCalled();
});
