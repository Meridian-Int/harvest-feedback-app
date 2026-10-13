import { beforeEach, expect, it, vi } from 'vitest';
import { requireUser } from './auth';
import { sharedRequest } from './shared-feedback-api';
import { getSharedAttachmentProperties, removeSharedAttachment, uploadSharedAttachment } from './shared-storage';
vi.mock('./auth', () => ({ requireUser: vi.fn() }));
vi.mock('./shared-feedback-api', () => ({ sharedRequest: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockReturnValue({ id: 'sub-1', harvest: { selectedOrganizationId: 'org-1' } } as never);
  vi.stubGlobal('fetch', vi.fn());
});
it('requests an upload bound to the selected organization', async () => {
  vi.mocked(sharedRequest).mockResolvedValue({ prepareAttachment: { key: 'feedback-media/sub-1/uuid', url: 'https://media.example.com/upload' } });
  vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));
  expect(await uploadSharedAttachment(new File(['xx'], 'image.png'), 'image.png', 'image/png')).toBe('feedback-media/sub-1/uuid');
  expect(sharedRequest).toHaveBeenCalledWith(expect.stringContaining('prepareAttachment'), { name: 'image.png', contentType: 'image/png', size: 2, organizationId: 'org-1' });
});
it('requires organization selection before requesting a capability', async () => {
  vi.mocked(requireUser).mockReturnValue({ id: 'sub-1' } as never);
  await expect(uploadSharedAttachment(new File(['x'], 'x.png'), 'x.png', 'image/png')).rejects.toThrow('Choose an organization');
  expect(sharedRequest).not.toHaveBeenCalled();
});
it('checks authorized metadata', async () => {
  vi.mocked(sharedRequest).mockResolvedValue({ attachmentAccess: { key: 'key', size: 2 } });
  expect(await getSharedAttachmentProperties('key')).toEqual({ size: 2 });
});
it('propagates backend cross-user and claimed-object denial', async () => {
  vi.mocked(sharedRequest).mockRejectedValue(new Error('Attachment unavailable.'));
  await expect(removeSharedAttachment('other-key')).rejects.toThrow('Attachment unavailable');
  expect(fetch).not.toHaveBeenCalled();
});
