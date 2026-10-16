import type { Attachment, Feedback } from './types';

function isAttachment(value: unknown): value is Attachment {
  const entry = value as Partial<Attachment> | null;
  return !!entry && typeof entry.attachmentKey === 'string' && !!entry.attachmentKey &&
    typeof entry.attachmentName === 'string' && typeof entry.attachmentType === 'string' &&
    typeof entry.attachmentSize === 'number';
}

/** Parses the API's attachment list (an array, or AWSJSON text from Amplify) and drops malformed entries. */
export function parseAttachments(value: unknown): Attachment[] {
  let list = value;
  if (typeof list === 'string') { try { list = JSON.parse(list); } catch { return []; } }
  return Array.isArray(list) ? list.filter(isAttachment).map(({ attachmentKey, attachmentName, attachmentType, attachmentSize }) => ({ attachmentKey, attachmentName, attachmentType, attachmentSize })) : [];
}

/** Every file on a report. Reports created before multiple attachments only carry the single legacy fields. */
export function reportAttachments(report: Pick<Feedback, 'attachments' | 'attachmentKey' | 'attachmentName' | 'attachmentType' | 'attachmentSize'>): Attachment[] {
  if (report.attachments?.length) return report.attachments;
  if (!report.attachmentKey && !report.attachmentName) return [];
  return [{ attachmentKey: report.attachmentKey ?? '', attachmentName: report.attachmentName ?? 'Attachment', attachmentType: report.attachmentType ?? '', attachmentSize: report.attachmentSize ?? 0 }];
}
