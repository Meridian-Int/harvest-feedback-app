import { requireUser } from './auth';
import { sharedRequest } from './shared-feedback-api';
interface Access { key: string; url?: string; size?: number; contentType?: string }
export async function uploadSharedAttachment(file: File, name: string, contentType: string): Promise<string> {
  const organizationId = requireUser().harvest?.selectedOrganizationId;
  if (!organizationId) throw new Error('Choose an organization to continue.');
  const data = await sharedRequest<{ prepareAttachment: Access }>(
    `mutation PrepareAttachment($name: String!, $contentType: String!, $size: Int!, $organizationId: String!) {
      prepareAttachment(name: $name, contentType: $contentType, size: $size, organizationId: $organizationId) { key url }
    }`, { name, contentType, size: file.size, organizationId });
  if (!data.prepareAttachment?.url || !data.prepareAttachment.key) throw new Error('Attachment unavailable.');
  const response = await fetch(data.prepareAttachment.url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file, credentials: 'omit' });
  if (!response.ok) throw new Error('Attachment upload failed. Try again.');
  return data.prepareAttachment.key;
}
async function access(key: string, operation: 'HEAD' | 'GET'): Promise<Access> {
  const data = await sharedRequest<{ attachmentAccess: Access }>(
    `query AttachmentAccess($key: String!, $operation: String!) {
      attachmentAccess(key: $key, operation: $operation) { key url size contentType }
    }`, { key, operation });
  if (!data.attachmentAccess) throw new Error('Attachment unavailable.');
  return data.attachmentAccess;
}
export async function getSharedAttachmentProperties(key: string): Promise<{ size: number }> {
  const data = await access(key, 'HEAD');
  if (data.size == null) throw new Error('Attachment unavailable.');
  return { size: data.size };
}
export async function getSharedAttachmentUrl(key: string): Promise<string> {
  const data = await access(key, 'GET');
  if (!data.url) throw new Error('Attachment unavailable.');
  const response = await fetch(data.url, { credentials: 'omit' });
  if (!response.ok) throw new Error('Attachment unavailable.');
  return URL.createObjectURL(await response.blob());
}
export async function removeSharedAttachment(key: string): Promise<void> {
  await sharedRequest(`mutation RemoveAttachment($key: String!) { removeAttachment(key: $key) }`, { key });
}
export async function sharedAttachmentIdentityId(): Promise<string> { return requireUser().id; }
