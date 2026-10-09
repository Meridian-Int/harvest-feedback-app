import type { AuthUser, Feedback, SentryIssue } from '../lib/types';

export function makeClientUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: 'company@example.com', email: 'company@example.com', name: 'Company', persona: 'Company', company: 'Northstar Company', groups: [], ...overrides };
}
export function makeAdminUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return makeClientUser({ id: 'admin@example.com', email: 'admin@example.com', name: 'Admin', persona: 'Operator', company: 'Meridian Operations', groups: ['admins'], ...overrides });
}
export function makeFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return { id: 'sample-0001', title: 'QuickBooks connection stops at authorization', description: 'Selecting Connect opens a blank authorization window. Our finance team cannot finish connecting QuickBooks.', productArea: 'Data room', priority: 'BLOCKER', severity: 'CRITICAL', status: 'NEW', reporterName: 'Company', reporterEmail: 'company@example.com', persona: 'Company', company: 'Northstar Company', owner: 'company@example.com', createdAt: '2026-10-08T16:40:00Z', updatedAt: '2026-10-08T16:40:00Z', ...overrides };
}
export function makeSentryIssue(overrides: Partial<SentryIssue> = {}): SentryIssue {
  return { id: 'issue-1', title: "Cannot read properties of undefined (reading 'amountMinor')", culprit: 'PaymentsDueList.tsx', project: 'harvest-ui', level: 'error', count: 176, userCount: 42, lastSeen: '2026-10-08T16:40:00Z', permalink: 'https://sentry.io/issues/1/', trend: [12, 18, 20, 35, 42, 26, 23], ...overrides };
}
