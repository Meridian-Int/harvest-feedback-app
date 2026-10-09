import { beforeEach, expect, it, vi } from 'vitest';
import { validateAttachment, type AttachmentRequest } from './validation';

const provider = 'cognito-idp.us-east-2.amazonaws.com/pool';
const dependencies = {
  provider,
  resolveIdentity: vi.fn(), inspectObject: vi.fn(),
};
let event: AttachmentRequest;
beforeEach(() => {
  vi.resetAllMocks();
  event = {
    identity: { sub: 'client-a', claims: { iss: `https://${provider}`, token_use: 'id' } }, token: 'id-token',
    attachment: { attachmentKey: 'feedback-media/identity-a/capture.png', attachmentName: 'capture.png', attachmentType: 'image/png', attachmentSize: 5 },
  };
  dependencies.resolveIdentity.mockResolvedValue('identity-a');
  dependencies.inspectObject.mockResolvedValue({ size: 5, type: 'image/png' });
});

it('uses Cognito to resolve the verified login and checks the actual object', async () => {
  await expect(validateAttachment(event, dependencies)).resolves.toEqual({ attachmentKey: event.attachment.attachmentKey });
  expect(dependencies.resolveIdentity).toHaveBeenCalledWith('id-token');
  expect(dependencies.inspectObject).toHaveBeenCalledWith(event.attachment.attachmentKey);
});

it('rejects another identity’s key even when the caller supplies a matching identity argument', async () => {
  event.attachment.attachmentKey = 'feedback-media/identity-b/capture.png';
  Object.assign(event.attachment, { identityId: 'identity-b' });
  await expect(validateAttachment(event, dependencies)).rejects.toThrow('unavailable');
  expect(dependencies.inspectObject).not.toHaveBeenCalled();
});

it.each(['feedback-media/identity-ab/file', 'feedback-media/identity-a/', 'public/file', 'feedback-media/identity-a'])('rejects invalid ownership path %s', async key => {
  event.attachment.attachmentKey = key;
  await expect(validateAttachment(event, dependencies)).rejects.toThrow('unavailable');
  expect(dependencies.inspectObject).not.toHaveBeenCalled();
});

it.each([undefined, 0, -1, 1.5, 50 * 1024 * 1024 + 1])('rejects invalid claimed size %s before calling services', async size => {
  event.attachment.attachmentSize = size;
  await expect(validateAttachment(event, dependencies)).rejects.toThrow('unavailable');
  expect(dependencies.resolveIdentity).not.toHaveBeenCalled();
});

it('rejects incomplete identity, wrong issuer, access tokens and missing token', async () => {
  for (const patch of [{ identity: undefined }, { identity: { sub: 'client-a', claims: { iss: 'https://other', token_use: 'id' } } }, { identity: { sub: 'client-a', claims: { iss: `https://${provider}`, token_use: 'access' } } }, { token: undefined }]) {
    await expect(validateAttachment({ ...event, ...patch }, dependencies)).rejects.toThrow('unavailable');
  }
  expect(dependencies.resolveIdentity).not.toHaveBeenCalled();
});

it('rejects unsupported media and metadata inconsistent with the object', async () => {
  await expect(validateAttachment({ ...event, attachment: { ...event.attachment, attachmentType: 'text/html' } }, dependencies)).rejects.toThrow('unavailable');
  dependencies.inspectObject.mockResolvedValueOnce({ size: 6, type: 'image/png' }).mockResolvedValueOnce({ size: 5, type: 'text/html' });
  await expect(validateAttachment(event, dependencies)).rejects.toThrow('unavailable');
  await expect(validateAttachment(event, dependencies)).rejects.toThrow('unavailable');
});

it('accepts recording codec parameters and fails closed when identity resolution fails', async () => {
  event.attachment.attachmentType = 'video/webm;codecs=vp8';
  dependencies.inspectObject.mockResolvedValue({ size: 5, type: 'video/webm;codecs=vp8' });
  await expect(validateAttachment(event, dependencies)).resolves.toEqual({ attachmentKey: event.attachment.attachmentKey });
  dependencies.resolveIdentity.mockResolvedValueOnce(undefined);
  await expect(validateAttachment(event, dependencies)).rejects.toThrow('unavailable');
  dependencies.resolveIdentity.mockRejectedValueOnce(new Error('Identity service failed'));
  await expect(validateAttachment(event, dependencies)).rejects.toThrow();
});
