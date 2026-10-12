import { describe, expect, it } from 'vitest';
import { feedbackEmail, verificationEmail, type FeedbackEmailKind } from './emails';

const report = { reportId: 'report-1234', reportTitle: '<script>alert(1)</script>', reportUrl: 'https://feedback.example.com/feedback/mine?report=report-1234', reporterName: '<img src=x onerror=alert(1)>' };

describe('Standalone feedback email content', () => {
  it.each<FeedbackEmailKind>(['client-submitted', 'admin-submitted', 'update-requested', 'admin-updated', 'status-changed', 'closed'])('renders safe template content for %s', kind => {
    const email = feedbackEmail({ ...report, kind });
    const document = new DOMParser().parseFromString(email.html, 'text/html');
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('a')?.href).toBe(report.reportUrl);
    expect(email.html).toContain('background:#fffdf9');
    expect(email.html).toContain('#183a32');
    expect(document.querySelector('img')?.getAttribute('src')).toBe('cid:harvest-feedback-mark');
    expect(email.html).toContain("Arial,Helvetica,sans-serif");
    expect(email.html).toContain('max-width:600px');
    expect(email.html).toContain('border-radius:18px');
    expect(email.text).toContain('FB-1234');
    expect(email.subject).not.toContain(report.reportTitle);
  });

  it.each(['javascript:alert(1)', 'http://feedback.example.com', 'https://user:pass@feedback.example.com'])('rejects unsafe links %s', reportUrl => {
    expect(() => feedbackEmail({ ...report, kind: 'client-submitted', reportUrl })).toThrow();
  });

  it.each(['ASSIGNED', 'IN_PROGRESS', 'CLOSED'] as const)('includes the actual status %s', status => {
    expect(feedbackEmail({ ...report, kind: 'admin-updated', status }).text).toContain('Status:');
  });

  it('preserves provider code and actual lifetime with signup-only copy', () => {
    const email = verificationEmail({ code: '00123456', expiresInMinutes: 10 });
    expect(email.html).toContain('00123456');
    expect(email.text).toContain('expires in 10 minutes');
    expect(email.text).toContain('then create your password');
    expect(email.text).not.toContain('code to sign in');
    expect(() => verificationEmail({ code: '<12345>', expiresInMinutes: 10 })).toThrow();
    expect(() => verificationEmail({ code: '123456', expiresInMinutes: 0 })).toThrow();
  });
});

it('can send while testing locally without a broken localhost button', () => {
  const email = feedbackEmail({ ...report, reportUrl: undefined, kind: 'client-submitted' });
  expect(email.html).not.toContain('<a href=');
  expect(email.text).toContain('Open HARVEST Feedback');
  expect(email.text).not.toContain('undefined');
});
it('shows both stages in a progress email', () => {
  expect(feedbackEmail({ ...report, kind: 'status-changed', previousStatus: 'NEW', status: 'ASSIGNED' }).text).toContain('New → Assigned');
});

it('clearly labels the saved report ID in submission receipts in HTML, text and subject', () => {
  const email = feedbackEmail({ ...report, kind: 'client-submitted', reportId: 'saved-report-ab12', status: 'NEW' });
  const document = new DOMParser().parseFromString(email.html, 'text/html');
  expect(document.body.textContent).toContain('Report ID: FB-AB12');
  expect(email.text).toContain('Report ID: FB-AB12');
  expect(email.text).toContain('Thank you for your feedback. We’ve received your report.');
  expect(email.subject).toContain('FB-AB12');
  expect(document.body.textContent).toContain('Report: '+report.reportTitle);
});

it.each<FeedbackEmailKind>(['client-submitted', 'update-requested', 'admin-updated', 'status-changed', 'closed'])('labels report details consistently for %s', kind => {
  const email = feedbackEmail({ ...report, kind, status: kind === 'closed' ? 'CLOSED' : 'ASSIGNED' });
  const document = new DOMParser().parseFromString(email.html, 'text/html');
  for (const label of ['Report ID: FB-1234', 'Report: '+report.reportTitle, kind === 'closed' ? 'Status: Closed' : 'Status: Assigned']) {
    expect(document.body.textContent).toContain(label);
    expect(email.text).toContain(label);
  }
});

it('describes an admin response as an update for the client', () => {
  const email = feedbackEmail({ ...report, kind: 'admin-updated', status: 'IN_PROGRESS' });
  expect(email.text).toContain('You have an update on your report.');
  expect(email.text).not.toContain('An administrator has updated');
});

it.each([
  ['BLOCKER', 'Blocker', `Your experience matters to us. We’ve received your report about “${report.reportTitle}”.`],
  ['BUG', 'Bug', `Your experience matters to us. We’ve received your report about “${report.reportTitle}”.`],
  ['IMPROVEMENT', 'Improvement', 'We’ve received your feedback. Thank you for helping improve HARVEST.'],
] as const)('personalizes %s confirmations from the saved feedback type', (priority, label, acknowledgement) => {
  const email = feedbackEmail({ ...report, kind: 'client-submitted', priority, reporterName: 'Manasa' });
  const document = new DOMParser().parseFromString(email.html, 'text/html');
  expect(document.body.textContent).toContain('Hello Manasa,');
  expect(document.body.textContent).toContain(acknowledgement);
  expect(email.text).toContain(acknowledgement);
  expect(email.text).toContain('Feedback type: '+label);
});

it('shows the company reference while keeping its link tied to the permanent report ID', () => {
  const email = feedbackEmail({ ...report, kind: 'client-submitted', referenceHandle: 'MERIDIAN', referenceNumber: 42 });
  expect(email.text).toContain('Report ID: MERIDIAN · #042');
  expect(email.subject).toContain('MERIDIAN · #042');
  const document = new DOMParser().parseFromString(email.html, 'text/html');
  expect(document.querySelector('a')?.href).toBe(report.reportUrl);
  expect(() => feedbackEmail({ ...report, kind: 'client-submitted', referenceHandle: 'MERIDIAN' })).toThrow('handle');
});

it('gives administrators the saved priority wording and account type', () => {
  const email = feedbackEmail({ ...report, kind: 'admin-submitted', priority: 'BLOCKER', persona: 'Partner', status: 'NEW' });
  expect(email.text).toContain('Urgent review required.');
  expect(email.text).toContain('(Partner)');
  expect(feedbackEmail({ ...report, kind: 'client-submitted', priority: 'BLOCKER', persona: 'Partner' }).text).not.toContain('Account type:');
});

it.each([
  ['BLOCKER','New blocker reported','Urgent review required.'],
  ['BUG','New bug reported','Review required.'],
  ['IMPROVEMENT','New improvement suggested','suggested'],
] as const)('keeps the %s admin submission concise while retaining its meaning', (priority, heading, phrase) => {
  const email = feedbackEmail({ ...report, kind:'admin-submitted', priority, reporterName:'Manasa', company:'Meridian Intelligence', persona:'Partner', referenceHandle:'MERIDIAN', referenceNumber:42, status:'NEW' });
  expect(email.text).toContain('Meridian Intelligence (Partner)');
  expect(email.text).not.toContain('Manasa');
  expect(email.subject).toContain(heading);
  expect(email.text).toContain(phrase);
  expect(email.text).toContain('MERIDIAN · #042');
  for(const row of ['Priority:','Account type:','Status:','Report:','Report ID:']) expect(email.text).not.toContain(row);
});
