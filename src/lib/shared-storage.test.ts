import { beforeEach, expect, it, vi } from 'vitest';
import { Amplify } from 'aws-amplify';
import { getUsableHarvestTokens } from './harvest-shared-session';
import { getSharedAttachmentProperties, getSharedAttachmentUrl, removeSharedAttachment, uploadSharedAttachment } from './shared-storage';

const sdk = vi.hoisted(() => ({ identitySend: vi.fn(), s3Send: vi.fn() }));
vi.mock('aws-amplify', () => ({ Amplify: { getConfig: vi.fn() } }));
vi.mock('./harvest-shared-session', () => ({ getUsableHarvestTokens: vi.fn() }));
vi.mock('@aws-sdk/client-cognito-identity', () => ({
  CognitoIdentityClient: class { send = sdk.identitySend; },
  GetIdCommand: class { constructor(public input: unknown) {} },
  GetCredentialsForIdentityCommand: class { constructor(public input: unknown) {} },
}));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = sdk.s3Send; },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  HeadObjectCommand: class { constructor(public input: unknown) {} },
  GetObjectCommand: class { constructor(public input: unknown) {} },
  DeleteObjectCommand: class { constructor(public input: unknown) {} },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Amplify.getConfig).mockReturnValue({
    Auth: { Cognito: { userPoolId: 'us-east-2_pool', identityPoolId: 'us-east-2:identity', userPoolClientId: 'client' } },
    Storage: { S3: { bucket: 'feedback-bucket', region: 'us-east-2' } },
  } as never);
  vi.mocked(getUsableHarvestTokens).mockResolvedValue({ accessToken: 'access', idToken: 'id', refreshToken: 'refresh', expiresAt: Date.now() + 60_000 });
  sdk.identitySend.mockResolvedValueOnce({ IdentityId: 'us-east-2:viewer' }).mockResolvedValueOnce({ Credentials: {
    AccessKeyId: 'key', SecretKey: 'secret', SessionToken: 'session',
  } });
  sdk.s3Send.mockResolvedValue({});
});

it('uploads into the signed-in identity’s Feedback path', async () => {
  const file = { arrayBuffer: async () => new Uint8Array([1, 2]).buffer } as File;
  const key = await uploadSharedAttachment(file, 'image.png', 'image/png');
  expect(key).toBe('feedback-media/us-east-2:viewer/image.png');
  expect(sdk.s3Send).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({
    Bucket: 'feedback-bucket', Key: key, ContentType: 'image/png',
  }) }));
});

it('checks object metadata and reads a media preview', async () => {
  sdk.s3Send.mockResolvedValueOnce({ ContentLength: 2 });
  expect(await getSharedAttachmentProperties('feedback-media/us-east-2:viewer/image.png')).toEqual({ size: 2 });
  sdk.identitySend.mockReset().mockResolvedValueOnce({ IdentityId: 'us-east-2:viewer' }).mockResolvedValueOnce({ Credentials: {
    AccessKeyId: 'key', SecretKey: 'secret', SessionToken: 'session',
  } });
  sdk.s3Send.mockResolvedValueOnce({ ContentType: 'image/png', Body: { transformToByteArray: async () => new Uint8Array([1, 2]) } });
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:preview') });
  expect(await getSharedAttachmentUrl('feedback-media/us-east-2:viewer/image.png')).toBe('blob:preview');
  vi.unstubAllGlobals();
});

it('refuses to remove a different identity’s object', async () => {
  await expect(removeSharedAttachment('feedback-media/other/file.png')).rejects.toThrow('Attachment unavailable');
  expect(sdk.s3Send).not.toHaveBeenCalled();
});
