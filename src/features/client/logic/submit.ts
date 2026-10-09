import type { ClientApi, Choices, Draft } from '../contract';
import { checkFile } from './file';
import { submissionDraft, validateDraft } from './form';

export async function submitFeedback(api: ClientApi, choices: Choices, draft: Draft, file: File | null) {
  const validation = validateDraft(draft, choices);
  if (validation.message) throw new Error(validation.message);
  const fileError = file && checkFile(file, choices.maxAttachmentBytes);
  if (fileError) throw new Error(fileError);
  const attachment = file ? await api.uploadAttachment(file) : undefined;
  try {
    return await api.createFeedback({ ...submissionDraft(draft, choices), ...attachment });
  } catch (error) {
    if (attachment) {
      try { await api.removeAttachment(attachment.attachmentKey); }
      catch { throw new Error('Feedback could not be submitted and the attachment could not be removed. Try again; tell the team if this continues.'); }
    }
    throw error;
  }
}
