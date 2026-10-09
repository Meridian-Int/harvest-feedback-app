import { beforeEach, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class { send = send; },
  AdminCreateUserCommand: class { constructor(public input: unknown) {} },
}));
import { handler } from './handler';

beforeEach(() => { send.mockReset(); vi.stubEnv('USER_POOL_ID', 'pool-123'); });

it('creates a partner with email OTP and Cognito-delivered invitation', async () => {
  send.mockResolvedValue({});
  expect(await handler({ arguments: { email: ' Pat@Example.com ', name: 'Pat Lee', company: 'Acme' } })).toBe('pat@example.com');
  const input = send.mock.calls[0][0].input;
  expect(input).toMatchObject({ UserPoolId: 'pool-123', Username: 'pat@example.com', DesiredDeliveryMediums: ['EMAIL'] });
  expect(input).not.toHaveProperty('TemporaryPassword');
  expect(input.UserAttributes).toContainEqual({ Name: 'custom:persona', Value: 'Partner' });
  expect(input.UserAttributes).toContainEqual({ Name: 'custom:company', Value: 'Acme' });
});

it('shows an existing account as an actionable invitation error', async () => {
  const cause = new Error('exists'); cause.name = 'UsernameExistsException';
  send.mockRejectedValue(cause);
  await expect(handler({ arguments: { email: 'pat@example.com', name: 'Pat', company: 'Acme' } })).rejects.toThrow('already has access');
});
