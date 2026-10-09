import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn(), send: vi.fn() }));
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class { send = mocks.list; },
  ListUsersInGroupCommand: class { constructor(public input: unknown) {} },
}));
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class { send = mocks.send; },
  SendEmailCommand: class { constructor(public input: unknown) {} },
}));
import { handler } from './handler';

const report = { id: 'report-1234', title: 'Upload stalled', company: 'Acme', persona: 'Partner' };

beforeEach(() => {
  mocks.list.mockReset(); mocks.send.mockReset();
  vi.stubEnv('USER_POOL_ID', 'pool-123');
  vi.stubEnv('ADMIN_NOTIFICATION_FROM_EMAIL', 'feedback@example.com');
  vi.stubEnv('APP_BASE_URL', 'https://dev.example.com');
});

it('sends a new partner report to enabled admin inboxes', async () => {
  mocks.list.mockResolvedValue({ Users: [
    { Enabled: true, Attributes: [{ Name: 'email', Value: 'admin@example.com' }] },
    { Enabled: false, Attributes: [{ Name: 'email', Value: 'disabled@example.com' }] },
  ] });
  mocks.send.mockResolvedValue({});
  expect(await handler(report)).toEqual({ sent: true });
  expect(mocks.list.mock.calls[0][0].input).toMatchObject({ UserPoolId: 'pool-123', GroupName: 'admins' });
  const email = mocks.send.mock.calls[0][0].input;
  expect(email.FromEmailAddress).toBe('feedback@example.com');
  expect(email.Destination.BccAddresses).toEqual(['admin@example.com']);
  expect(email.Content.Simple.Body.Text.Data).toContain('https://dev.example.com/admin/reviews?report=report-1234');
});

it('does not call SES when no verified sender is configured', async () => {
  vi.stubEnv('ADMIN_NOTIFICATION_FROM_EMAIL', '');
  expect(await handler(report)).toEqual({ sent: false });
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});
