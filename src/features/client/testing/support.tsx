import './setup';
import type { ClientApi, ClientControls, Choices, Feedback } from '../contract';
import { vi } from 'vitest';

// Isolated feature fixtures; production options must come from src/lib/options.ts.
export const choices: Choices = {
  productAreas: [{ value: 'Data room', label: 'Data room' }, { value: 'Other', label: 'Other — add an area' }],
  priorities: ['BLOCKER', 'BUG', 'IMPROVEMENT'].map(value => ({ value, label: value[0] + value.slice(1).toLowerCase() })),
  severities: ['CRITICAL', 'MEDIUM', 'LOW'].map(value => ({ value, label: value[0] + value.slice(1).toLowerCase() })),
  otherArea: 'Other', maxAttachmentBytes: 50 * 1024 * 1024,
};
export const controls: ClientControls = {
  Panel: props => <div {...props} />, Button: props => <button {...props} />, Input: props => <input {...props} />, Select: props => <select {...props} />, Textarea: props => <textarea {...props} />,
};
export const makeReport = (overrides: Partial<Feedback> = {}): Feedback => ({ id: 'report-abcd', title: 'Download fails in data room', description: 'Download fails for signed document', productArea: 'Data room', priority: 'BUG', severity: 'MEDIUM', status: 'NEW', createdAt: '2026-10-09T10:00:00Z', ...overrides });
export const makeApi = (): ClientApi => ({
  listMyFeedback: vi.fn().mockResolvedValue([]), getFeedback: vi.fn().mockResolvedValue(makeReport()),
  createFeedback: vi.fn().mockResolvedValue(makeReport()), uploadAttachment: vi.fn().mockResolvedValue({ attachmentKey: 'feedback-media/test/file', attachmentName: 'image.png', attachmentType: 'image/png', attachmentSize: 1 }),
  removeAttachment: vi.fn().mockResolvedValue(undefined), requestUpdate: vi.fn().mockResolvedValue(undefined),
});
