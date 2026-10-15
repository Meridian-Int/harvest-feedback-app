import { beforeEach, expect, it, vi } from 'vitest';
import { selectedAdministrators } from './administrators';
const sdk = vi.hoisted(() => ({ lambda: vi.fn(), cognito: vi.fn() }));
vi.mock('@aws-sdk/client-lambda', async original => ({ ...await original<object>(), LambdaClient: class { send = sdk.lambda } }));
vi.mock('@aws-sdk/client-cognito-identity-provider', async original => ({ ...await original<object>(), CognitoIdentityProviderClient: class { send = sdk.cognito } }));
const sub = 'e18b45b0-6011-70c6-4052-644877433da2';
const profile = { sub, email: 'sahil+admin@withmeridian.ai', name: 'Sahil' };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('HARVEST_USER_POOL_ID', 'us-east-2_pool');
  vi.stubEnv('HARVEST_DIRECTORY_FUNCTION_ARN', 'arn:aws:lambda:us-east-2:938463256739:function:harvest-feedback-dev-directory');
  sdk.lambda.mockResolvedValue({ Payload: Buffer.from(JSON.stringify([profile])) });
  sdk.cognito.mockResolvedValue({ Enabled: true, UserStatus: 'CONFIRMED', UserAttributes: [{ Name: 'sub', Value: sub }, { Name: 'email', Value: profile.email }] });
});
it('returns active Operator members with enabled Cognito identities', async () => {
  expect(await selectedAdministrators()).toEqual([profile]);
  const payload = JSON.parse(Buffer.from(sdk.lambda.mock.calls[0][0].input.Payload).toString());
  expect(payload).toEqual({ operation: 'harvest-feedback-admin-directory' });
});
it('excludes downgraded or revoked members and disabled users without cached recipients', async () => {
  expect(await selectedAdministrators()).toHaveLength(1);
  sdk.lambda.mockResolvedValue({ Payload: Buffer.from('[]') });
  expect(await selectedAdministrators()).toEqual([]);
  sdk.lambda.mockResolvedValue({ Payload: Buffer.from(JSON.stringify([profile])) });
  sdk.cognito.mockResolvedValue({ Enabled: false });
  expect(await selectedAdministrators()).toEqual([]);
});
it('rejects malformed or duplicate directory identities and an unavailable trusted service', async () => {
  sdk.lambda.mockResolvedValueOnce({ Payload: Buffer.from(JSON.stringify([{ ...profile, sub: 'unselected' }])) });
  await expect(selectedAdministrators()).rejects.toThrow('invalid identity');
  sdk.lambda.mockResolvedValueOnce({ Payload: Buffer.from(JSON.stringify([profile, profile])) });
  await expect(selectedAdministrators()).rejects.toThrow('invalid identity');
  sdk.lambda.mockResolvedValueOnce({ FunctionError: 'Unhandled' });
  await expect(selectedAdministrators()).rejects.toThrow('lookup failed');
});
it('rejects an unbounded directory response', async () => {
  sdk.lambda.mockResolvedValueOnce({ Payload: Buffer.from(JSON.stringify(Array(101).fill(profile))) });
  await expect(selectedAdministrators()).rejects.toThrow('invalid response');
  expect(sdk.cognito).not.toHaveBeenCalled();
});
