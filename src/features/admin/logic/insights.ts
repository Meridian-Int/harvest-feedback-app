import type { CreateFeedbackInput, Feedback, SentryIssue } from '../../../lib/types';

export function filterIssues(issues: readonly SentryIssue[], project: string): SentryIssue[] {
  return project ? issues.filter(issue => issue.project === project) : [...issues];
}

export function issueMetrics(issues: readonly SentryIssue[]) {
  return {
    issues: issues.length,
    events: issues.reduce((total, issue) => total + issue.count, 0),
    projects: new Set(issues.map(issue => issue.project)).size,
  };
}

export function linkedReport(issue: SentryIssue, reports: readonly Feedback[]): Feedback | undefined {
  return reports.find(report => report.sentryIssueId === issue.id);
}

export function reportFromIssue(issue: SentryIssue): CreateFeedbackInput {
  return {
    description: [issue.title, `Location: ${issue.culprit}`, `Project: ${issue.project}`, `${issue.count} events affecting ${issue.userCount} users.`].join('\n').slice(0, 3000),
    productArea: 'Other — add an area',
    customArea: 'Sentry issue',
    priority: 'BUG',
    severity: ['error', 'fatal'].includes(issue.level.toLowerCase()) ? 'CRITICAL' : 'MEDIUM',
    sentryIssueId: issue.id,
  };
}

export function lookerEmbedUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'lookerstudio.google.com' && url.pathname.includes('/embed/') ? url.href : null;
  } catch {
    return null;
  }
}
