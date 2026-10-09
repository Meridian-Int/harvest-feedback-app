import { makeFeedback, makeSentryIssue } from '../../../test/factories';
import { filterIssues, issueMetrics, linkedReport, lookerEmbedUrl, reportFromIssue } from './insights';

const issueA = makeSentryIssue();
const issueB = makeSentryIssue({ id: 'issue-2', project: 'harvest-api', level: 'warning', count: 20, userCount: 5 });

it('filters issues by project and calculates visible metrics', () => {
  expect(issueMetrics([issueA, issueB])).toEqual({ issues: 2, events: 196, projects: 2 });
  expect(filterIssues([issueA, issueB], 'harvest-api')).toEqual([issueB]);
  expect(issueMetrics(filterIssues([issueA, issueB], 'harvest-api'))).toEqual({ issues: 1, events: 20, projects: 1 });
});

it('finds an existing linked report', () => {
  const report = makeFeedback({ sentryIssueId: issueA.id });
  expect(linkedReport(issueA, [makeFeedback(), report])).toBe(report);
  expect(linkedReport(issueB, [report])).toBeUndefined();
});

it('builds a valid admin report from an issue and maps severity', () => {
  expect(reportFromIssue(issueA)).toMatchObject({ productArea: 'Other — add an area', customArea: 'Sentry issue', priority: 'BUG', severity: 'CRITICAL', sentryIssueId: issueA.id });
  expect(reportFromIssue(issueB).severity).toBe('MEDIUM');
  expect(reportFromIssue(makeSentryIssue({ title: 'x'.repeat(3100) })).description).toHaveLength(3000);
});

it('accepts only a secure Looker embed URL', () => {
  expect(lookerEmbedUrl('https://lookerstudio.google.com/embed/reporting/123')).toBe('https://lookerstudio.google.com/embed/reporting/123');
  for (const value of [undefined, 'not a url', 'http://lookerstudio.google.com/embed/reporting/123', 'https://lookerstudio.google.com/reporting/123', 'https://other.example/embed/reporting/123']) {
    expect(lookerEmbedUrl(value)).toBeNull();
  }
});
