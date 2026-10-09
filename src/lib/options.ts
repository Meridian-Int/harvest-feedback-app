import type { Priority, Severity, Status } from './types';

export const PRODUCT_AREAS = [
  'Onboarding', 'Data room', 'Payment — payout account setup',
  'Partner portfolio', 'Operations console', 'Other — add an area',
] as const;
export const PRIORITIES = ['Blocker', 'Bug', 'Improvement'] as const;
export const SEVERITIES = ['Critical', 'Medium', 'Low'] as const;
export const STATUSES = ['New', 'Assigned', 'In progress', 'Closed'] as const;
export const PERSONAS = ['Company', 'Partner'] as const;
// The only administrator in the development auth adapter. Replace when Cognito is wired.
export const ASSIGNEES = [
  { value: '', label: 'Unassigned' },
  { value: 'admin@example.com', label: 'Admin' },
] as const;
export const SENTRY_PROJECTS = ['harvest-ui', 'harvest-api', 'feedback-app'] as const;
export const PRIORITY_LABELS: Record<Priority, typeof PRIORITIES[number]> = {
  BLOCKER: 'Blocker', BUG: 'Bug', IMPROVEMENT: 'Improvement',
};
export const SEVERITY_LABELS: Record<Severity, typeof SEVERITIES[number]> = {
  CRITICAL: 'Critical', MEDIUM: 'Medium', LOW: 'Low',
};
export const STATUS_LABELS: Record<Status, typeof STATUSES[number]> = {
  NEW: 'New', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', CLOSED: 'Closed',
};
export const STATUS_ORDER: readonly Status[] = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'];
export const REPORT_PAGE_SIZE = 6;
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = '.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov';
