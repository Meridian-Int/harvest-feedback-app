import { ASSIGNEES } from './options';
import { isHarvestSharedSessionMode } from './amplify';
import { sharedRequest } from './shared-feedback-api';
export interface AssigneeOption { value: string; label: string }
export async function feedbackAssignees(): Promise<AssigneeOption[]> {
  if (!isHarvestSharedSessionMode()) return [...ASSIGNEES];
  const data = await sharedRequest<{ feedbackAdministrators: Array<{ sub: string; email: string; name?: string | null }> }>(
    `query FeedbackAdministrators { feedbackAdministrators { sub email name } }`, {},
  );
  if (!Array.isArray(data.feedbackAdministrators)) throw new Error('Could not load Feedback administrators.');
  return [...ASSIGNEES, ...data.feedbackAdministrators.map(admin => ({ value: admin.sub, label: admin.name || admin.email }))];
}
