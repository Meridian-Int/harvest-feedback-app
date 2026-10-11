import { describe, expect, it } from 'vitest';
import { feedbackEmail, verificationEmail, type FeedbackEmailKind } from './emails';

const report = { reportId: 'report-1234', reportTitle: '<script>alert(1)</script>', reportUrl: 'https://feedback.example.com/feedback/mine?report=report-1234', reporterName: '<img src=x onerror=alert(1)>' };

describe('Standalone feedback email content', () => {
  it.each<FeedbackEmailKind>(['client-submitted', 'admin-submitted', 'update-requested', 'admin-updated', 'closed'])('renders safe template content for %s', kind => {
    const email = feedbackEmail({ ...report, kind });
    const document = new DOMParser().parseFromString(email.html, 'text/html');
    expect(document.querySelector('script, img')).toBeNull();
    expect(document.querySelector('a')?.href).toBe(report.reportUrl);
    expect(email.html).toContain('background:#eee9df');
    expect(email.html).toContain("Georgia,'Times New Roman',serif");
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
