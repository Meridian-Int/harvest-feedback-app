export interface AttachmentRequest {
  identity?: { sub?: string; claims?: Record<string, unknown> };
  token?: string;
  attachment: AttachmentClaim;
  /** Every submitted file; absent from older resolver payloads that sent only `attachment`. */
  attachments?: AttachmentClaim[];
}
type AttachmentClaim = { attachmentKey?: string | null; attachmentName?: string | null; attachmentType?: string | null; attachmentSize?: number | null };

interface Dependencies {
  provider: string;
  resolveIdentity: (token: string) => Promise<string | undefined>;
  inspectObject: (key: string) => Promise<{ size?: number; type?: string }>;
}

const types = ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];

/** AppSync supplies the verified identity; never accept an identity ID from arguments. */
export async function validateAttachment(event: AttachmentRequest, dependencies: Dependencies) {
  const { attachmentKey: key, attachmentName: name, attachmentType: type, attachmentSize: size } = event.attachment;
  if (!event.identity?.sub || event.identity.claims?.iss !== `https://${dependencies.provider}` ||
      event.identity.claims?.token_use !== 'id' || !event.token) throw new Error('Attachment unavailable.');
  if (!key || !name || !type || !types.includes(type.split(';')[0]) ||
      !Number.isInteger(size) || size! <= 0 || size! > 50 * 1024 * 1024) throw new Error('Attachment unavailable.');
  const identityId = await dependencies.resolveIdentity(event.token);
  const prefix = `feedback-media/${identityId}/`;
  if (!identityId || !key.startsWith(prefix) || key.length <= prefix.length) throw new Error('Attachment unavailable.');
  const stored = await dependencies.inspectObject(key);
  if (stored.size !== size || stored.type?.split(';')[0] !== type.split(';')[0]) throw new Error('Attachment unavailable.');
  return { attachmentKey: key };
}

/** Verifies each submitted file (at most five, no repeats) with the same rules as a single attachment. */
export async function validateAttachments(event: AttachmentRequest, dependencies: Dependencies) {
  const claims = event.attachments?.length ? event.attachments : [event.attachment];
  const keys = claims.map(claim => claim.attachmentKey);
  if (claims.length > 5 || new Set(keys).size !== keys.length) throw new Error('Attachment unavailable.');
  const attachmentKeys: string[] = [];
  for (const attachment of claims) attachmentKeys.push((await validateAttachment({ ...event, attachment }, dependencies)).attachmentKey);
  return { attachmentKey: attachmentKeys[0], attachmentKeys };
}
