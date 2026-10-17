import type { Choices, Draft } from '../contract';

// Short enough that the whole title shows on one line in My reports and the admin list.
export const TITLE_LIMIT = 60;
export const emptyDraft = (): Draft => ({ title: '', productArea: '', customArea: '', priority: '', severity: '', description: '' });
export const titleFromDescription = (description: string) => description.trim().split(/\r?\n/)[0].slice(0, 110);
export function validateDraft(draft: Draft, choices: Choices) {
  const errors: Partial<Record<keyof Draft, string>> = {};
  // Validation/focus order matches the prototype's combined message.
  if (!draft.title.trim()) errors.title = 'add a title';
  else if (draft.title.trim().length > TITLE_LIMIT) errors.title = `keep the title to ${TITLE_LIMIT} characters`;
  if (!draft.description.trim()) errors.description = 'describe your feedback';
  else if (draft.description.trim().length > 3000) errors.description = 'keep the description to 3000 characters';
  if (!choices.priorities.some(o => o.value === draft.priority)) errors.priority = 'choose a priority';
  if (!choices.productAreas.some(o => o.value === draft.productArea)) errors.productArea = 'choose or name a category';
  else if (draft.productArea === choices.otherArea) {
    if (!draft.customArea.trim()) errors.customArea = 'choose or name a category';
    else if (draft.customArea.trim().length > 80) errors.customArea = 'keep the area name to 80 characters';
  }
  const first = Object.keys(errors)[0] as keyof Draft | undefined;
  return { errors, first, message: first ? `Please ${Object.values(errors).join(', ')}.` : '' };
}
export function submissionDraft(draft: Draft, choices: Choices): Draft & { title: string } {
  return { ...draft, severity: severityForPriority(draft.priority), description: draft.description.trim(), customArea: draft.productArea === choices.otherArea ? draft.customArea.trim() : '', title: draft.title.trim() };
}

// The deployed API still requires severity. Derive it from the single priority
// selection until a separately approved backend migration removes the field.
export function severityForPriority(priority: string): string {
  return priority === 'BLOCKER' ? 'CRITICAL' : priority === 'BUG' ? 'MEDIUM' : 'LOW';
}
