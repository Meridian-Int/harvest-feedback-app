import { expect, it } from 'vitest';
import { adminEmails, reportNotice } from './message';

it('deduplicates admin recipients from Cognito group members', () => {
  expect(adminEmails([
    { Attributes: [{ Name: 'email', Value: 'Admin@Example.com' }] },
    { Attributes: [{ Name: 'email', Value: 'admin@example.com' }] },
    { Attributes: [{ Name: 'name', Value: 'No email' }] },
  ])).toEqual(['admin@example.com']);
});

it('builds a report email without feedback description or reporter email', () => {
  const notice = reportNotice({ id: 'abc-1234', title: 'Upload stalled', company: 'Acme', persona: 'Partner' }, 'https://dev.example.com/');
  expect(notice.subject).toContain('FB-1234');
  expect(notice.body).toContain('https://dev.example.com/admin/reviews?report=abc-1234');
  expect(notice.body).toContain('Upload stalled');
});
