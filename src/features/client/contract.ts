import type { ComponentType, ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

// Integration boundary until Phase 0 publishes its actual adapter and UI exports.
// The route wrapper supplies these from src/lib/feedback and src/components/ui.
export type Status = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
export interface Feedback {
  id: string;
  title: string;
  description: string;
  productArea: string;
  customArea?: string | null;
  priority: string;
  severity: string;
  status: Status;
  createdAt: string;
  updateRequestedAt?: string | null;
  adminActivityAt?: string | null;
}
export interface Draft {
  productArea: string;
  customArea: string;
  priority: string;
  severity: string;
  description: string;
}
export interface Choices {
  productAreas: readonly { value: string; label: string }[];
  priorities: readonly { value: string; label: string }[];
  severities: readonly { value: string; label: string }[];
  otherArea: string;
  maxAttachmentBytes: number;
}
export interface Attachment {
  attachmentKey: string;
  attachmentName: string;
  attachmentType: string;
  attachmentSize: number;
}
export interface ClientApi {
  listMyFeedback(): Promise<Feedback[]>;
  getFeedback(id: string): Promise<Feedback | null>;
  // Adapter authenticates reporter attributes and defaults status on the server.
  createFeedback(input: Draft & { title: string } & Partial<Attachment>): Promise<Feedback>;
  uploadAttachment(file: File): Promise<Attachment>;
  // Required compensation if create fails after an upload succeeds.
  removeAttachment(key: string): Promise<void>;
  requestUpdate(id: string): Promise<void>;
  // Adapter subscribes to an owner-authorized query, not the whole table.
  subscribeMyFeedback?(next: (reports: Feedback[]) => void, error: () => void): () => void;
}
export interface ClientControls {
  Panel: ComponentType<HTMLAttributes<HTMLElement>>;
  Button: ComponentType<ButtonHTMLAttributes<HTMLButtonElement>>;
  Input: ComponentType<InputHTMLAttributes<HTMLInputElement>>;
  Select: ComponentType<SelectHTMLAttributes<HTMLSelectElement>>;
  Textarea: ComponentType<TextareaHTMLAttributes<HTMLTextAreaElement>>;
}
export interface ClientProps {
  api: ClientApi;
  choices: Choices;
  controls: ClientControls;
  // Opaque account scope prevents drafts leaking between users on one browser.
  draftScope: string;
}
