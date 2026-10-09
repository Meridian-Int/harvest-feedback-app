import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { getProperties, getUrl, remove, uploadData } from 'aws-amplify/storage';
import type { Schema } from '../../amplify/data/resource';
import { requireAmplify } from './amplify';
import { isAdmin, requireUser } from './auth';
import { sortFeedback } from './list';
import { ASSIGNEES, MAX_ATTACHMENT_BYTES, PRODUCT_AREAS, PRIORITY_LABELS, SEVERITY_LABELS, STATUS_ORDER } from './options';
import { isUpdatePending } from './status';
import type { AdminUpdateInput, Attachment, AuthUser, CreateFeedbackInput, Feedback, Priority, Severity, Status } from './types';

export type { AdminUpdateInput, Attachment, CreateFeedbackInput, Feedback } from './types';

const client = generateClient<Schema>();
const FILE_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
};

function requireAdmin(user: AuthUser): void {
  if (!isAdmin(user)) throw new Error('Admin access required.');
}

function resultOrThrow<T>(result: { data: T; errors?: readonly { message: string }[] }): T {
  if (result.errors?.length) throw new Error(result.errors[0].message);
  return result.data;
}

type FeedbackRecord = NonNullable<Awaited<ReturnType<typeof client.models.Feedback.get>>['data']>;
type SubmittedFeedbackRecord = NonNullable<Awaited<ReturnType<typeof client.mutations.submitFeedback>>['data']>;

function toFeedback(row: FeedbackRecord | SubmittedFeedbackRecord): Feedback {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    productArea: row.productArea,
    priority: row.priority as Priority,
    severity: row.severity as Severity,
    reporterName: row.reporterName,
    reporterEmail: row.reporterEmail,
    persona: row.persona as Feedback['persona'],
    company: row.company,
    status: (row.status ?? 'NEW') as Status,
    owner: row.owner ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.customArea ? { customArea: row.customArea } : {}),
    ...(row.assignee ? { assignee: row.assignee } : {}),
    ...(row.updateRequestedAt ? { updateRequestedAt: row.updateRequestedAt } : {}),
    ...(row.adminActivityAt ? { adminActivityAt: row.adminActivityAt } : {}),
    ...(row.sentryIssueId ? { sentryIssueId: row.sentryIssueId } : {}),
    ...(row.attachmentKey ? { attachmentKey: row.attachmentKey } : {}),
    ...(row.attachmentName ? { attachmentName: row.attachmentName } : {}),
    ...(row.attachmentType ? { attachmentType: row.attachmentType } : {}),
    ...(row.attachmentSize != null ? { attachmentSize: row.attachmentSize } : {}),
  };
}

function ownedBy(report: Feedback, user: AuthUser): boolean {
  return report.owner === user.id || report.owner.startsWith(`${user.id}::`) || report.reporterEmail === user.email;
}

async function listFeedback(): Promise<Feedback[]> {
  const rows: Feedback[] = [];
  let nextToken: string | null | undefined;
  do {
    const response = await client.models.Feedback.list({ limit: 100, nextToken });
    rows.push(...resultOrThrow(response).map(toFeedback));
    nextToken = response.nextToken;
  } while (nextToken);
  return sortFeedback(rows);
}

export async function createFeedback(input: CreateFeedbackInput): Promise<Feedback> {
  requireAmplify();
  const user = requireUser();
  const description = input.description.trim();
  if (!description || description.length > 3000) throw new Error('Please describe the bug or improvement (up to 3000 characters).');
  if (!PRODUCT_AREAS.includes(input.productArea as typeof PRODUCT_AREAS[number])) throw new Error('Please choose a product area.');
  const customArea = input.customArea?.trim();
  if (input.productArea === 'Other — add an area' && (!customArea || customArea.length > 80)) throw new Error('Please name the product area (up to 80 characters).');
  if (!Object.hasOwn(PRIORITY_LABELS, input.priority) || !Object.hasOwn(SEVERITY_LABELS, input.severity)) throw new Error('Please choose a priority and severity.');
  if (input.sentryIssueId) requireAdmin(user);

  let attachment: Attachment | undefined;
  if (input.attachmentKey) {
    const identityId = (await fetchAuthSession()).identityId;
    if (!identityId || !input.attachmentKey.startsWith(`feedback-media/${identityId}/`)) throw new Error('Attachment unavailable.');
    const properties = await getProperties({ path: input.attachmentKey });
    if (!input.attachmentName || !input.attachmentType || properties.size == null || properties.size > MAX_ATTACHMENT_BYTES) throw new Error('Attachment unavailable.');
    if ((await listMyFeedback()).some(report => report.attachmentKey === input.attachmentKey)) throw new Error('Attachment unavailable.');
    attachment = {
      attachmentKey: input.attachmentKey,
      attachmentName: input.attachmentName,
      attachmentType: input.attachmentType,
      attachmentSize: properties.size,
    };
  }
  const token = (await fetchAuthSession()).tokens?.idToken?.toString();
  if (!token) throw new Error('Sign in to Harvest');
  const created = resultOrThrow(await client.mutations.submitFeedback({
    description, productArea: input.productArea,
    ...(input.productArea === 'Other — add an area' ? { customArea } : {}),
    priority: input.priority, severity: input.severity,
    ...(input.sentryIssueId ? { sentryIssueId: input.sentryIssueId } : {}),
    ...attachment,
  }, { authToken: token }));
  if (!created) throw new Error('Could not create the report.');
  return toFeedback(created);
}

export async function listMyFeedback(): Promise<Feedback[]> {
  requireAmplify();
  const user = requireUser();
  return (await listFeedback()).filter(report => ownedBy(report, user));
}

export async function listAllFeedback(): Promise<Feedback[]> {
  requireAmplify();
  requireAdmin(requireUser());
  return listFeedback();
}

/** Model updates stream through observeQuery; secure custom creates signal a refetch. */
export function observeAllFeedback(onChange: (reports: Feedback[]) => void, onError: (error: Error) => void): () => void {
  requireAmplify();
  requireAdmin(requireUser());
  const fail = (cause: unknown) => onError(cause instanceof Error ? cause : new Error('Could not load reports.'));
  const model = client.models.Feedback.observeQuery().subscribe({
    next: ({ items, isSynced }) => { if (isSynced) onChange(sortFeedback(items.map(toFeedback))); },
    error: fail,
  });
  let created;
  try {
    created = client.subscriptions.feedbackSubmitted().subscribe({
      next: () => { void listAllFeedback().then(onChange).catch(fail); },
      error: fail,
    });
  } catch (cause) {
    model.unsubscribe();
    throw cause;
  }
  return () => { model.unsubscribe(); created.unsubscribe(); };
}

export async function getFeedback(id: string): Promise<Feedback | null> {
  requireAmplify();
  requireUser();
  const row = resultOrThrow(await client.models.Feedback.get({ id }));
  return row ? toFeedback(row) : null;
}

export async function requestUpdate(id: string): Promise<Feedback> {
  const user = requireUser();
  const report = await getFeedback(id);
  if (!report) throw new Error('Report unavailable.');
  if (!ownedBy(report, user) || report.status === 'CLOSED') throw new Error('An update cannot be requested for this report.');
  if (isUpdatePending(report)) return report;
  const timestamp = new Date(Math.max(Date.now(), Date.parse(report.adminActivityAt ?? '') + 1 || 0)).toISOString();
  const updated = resultOrThrow(await client.models.Feedback.update({ id, updateRequestedAt: timestamp }));
  if (!updated) throw new Error('Report unavailable.');
  return toFeedback(updated);
}

export async function adminUpdate(id: string, input: AdminUpdateInput): Promise<Feedback> {
  requireAdmin(requireUser());
  if (!STATUS_ORDER.includes(input.status) || (input.assignee && !ASSIGNEES.some(item => item.value === input.assignee))) {
    throw new Error('Please choose a valid status and owner.');
  }
  const report = await getFeedback(id);
  if (!report) throw new Error('Report unavailable.');
  const timestamp = new Date(Math.max(Date.now(), Date.parse(report.updateRequestedAt ?? '') + 1 || 0)).toISOString();
  const updated = resultOrThrow(await client.models.Feedback.update({
    id, status: input.status, assignee: input.assignee || null, adminActivityAt: timestamp,
  }));
  if (!updated) throw new Error('Report unavailable.');
  return toFeedback(updated);
}

export async function uploadAttachment(file: File): Promise<Attachment> {
  requireAmplify();
  requireUser();
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  if (!extension || !Object.hasOwn(FILE_TYPES, extension) || (file.type && file.type.split(';', 1)[0] !== FILE_TYPES[extension])) {
    throw new Error('Use a PNG, JPG, WebP image or an MP4, WebM or MOV recording.');
  }
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('Keep the attachment under 50 MB.');
  const name = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const uploaded = await uploadData({
    path: ({ identityId }) => `feedback-media/${identityId}/${name}`,
    data: file,
    options: { contentType: file.type || FILE_TYPES[extension] },
  }).result;
  return {
    attachmentKey: uploaded.path,
    attachmentName: file.name,
    attachmentType: file.type || FILE_TYPES[extension],
    attachmentSize: file.size,
  };
}

export async function getAttachmentUrl(key: string): Promise<string> {
  requireAmplify();
  requireUser();
  try {
    return (await getUrl({ path: key, options: { validateObjectExistence: true } })).url.toString();
  } catch {
    throw new Error('Attachment unavailable.');
  }
}

/** Only remove unclaimed uploads; a failed response may still have created the report. */
export async function removeAttachment(key: string): Promise<void> {
  requireAmplify();
  requireUser();
  const identityId = (await fetchAuthSession()).identityId;
  if (!identityId || !key.startsWith(`feedback-media/${identityId}/`)) throw new Error('Attachment unavailable.');
  if ((await listMyFeedback()).some(report => report.attachmentKey === key)) throw new Error('Attachment is already attached to a report.');
  await remove({ path: key });
}

/** AppSync enforces ownership; the additional filter also scopes admin client views. */
export function subscribeMyFeedback(next: (reports: Feedback[]) => void, error: () => void): () => void {
  requireAmplify();
  const user = requireUser();
  const subscription = client.models.Feedback.observeQuery().subscribe({
    next: ({ items, isSynced }) => {
      if (isSynced) next(sortFeedback(items.map(toFeedback).filter(report => ownedBy(report, user))));
    },
    error,
  });
  return () => subscription.unsubscribe();
}
