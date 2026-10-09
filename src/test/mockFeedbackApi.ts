import { vi } from 'vitest';
import type * as Api from '../lib/feedback';

export const mockFeedbackApi = {
  createFeedback: vi.fn<typeof Api.createFeedback>(),
  listMyFeedback: vi.fn<typeof Api.listMyFeedback>(),
  listAllFeedback: vi.fn<typeof Api.listAllFeedback>(),
  observeAllFeedback: vi.fn<typeof Api.observeAllFeedback>(),
  getFeedback: vi.fn<typeof Api.getFeedback>(),
  requestUpdate: vi.fn<typeof Api.requestUpdate>(),
  adminUpdate: vi.fn<typeof Api.adminUpdate>(),
  uploadAttachment: vi.fn<typeof Api.uploadAttachment>(),
  getAttachmentUrl: vi.fn<typeof Api.getAttachmentUrl>(),
};
