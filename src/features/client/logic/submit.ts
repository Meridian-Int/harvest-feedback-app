import type { Attachment, ClientApi, Choices, Draft } from '../contract';
import { checkFile } from './file';
import { submissionDraft, validateDraft } from './form';

export async function submitFeedback(api: ClientApi, choices: Choices, draft: Draft, files: readonly File[]) {
  const validation = validateDraft(draft, choices);
  if (validation.message) throw new Error(validation.message);
  if (files.length > choices.maxAttachments) throw new Error(`Attach up to ${choices.maxAttachments} files.`);
  for (const file of files) {
    const fileError = checkFile(file, choices.maxAttachmentBytes);
    if (fileError) throw new Error(fileError);
  }
  const uploads = await Promise.allSettled(files.map(file => api.uploadAttachment(file)));
  const attachments = uploads.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  try {
    const failed = uploads.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) throw failed.reason;
    return await api.createFeedback({ ...submissionDraft(draft, choices), ...(attachments.length ? { attachments } : {}) });
  } catch (error) {
    await removeUploads(api, attachments);
    throw error;
  }
}

async function removeUploads(api: ClientApi, attachments: Attachment[]) {
  const removed = await Promise.allSettled(attachments.map(attachment => api.removeAttachment(attachment.attachmentKey)));
  if (removed.some(result => result.status === 'rejected')) {
    throw new Error('Feedback could not be submitted and the attachments could not be removed. Try again; tell the team if this continues.');
  }
}
