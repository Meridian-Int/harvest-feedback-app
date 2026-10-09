import { beforeEach, vi } from 'vitest';
import { adminUpdate, createFeedback, getAttachmentUrl, getFeedback, listAllFeedback, listMyFeedback, observeAllFeedback, removeAttachment, subscribeMyFeedback, requestUpdate, uploadAttachment } from './feedback';
import { isUpdatePending } from './status';
import type { AuthUser, CreateFeedbackInput, Feedback } from './types';

const state = vi.hoisted(() => ({ user: null as AuthUser | null }));
const data = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), update: vi.fn(), observeQuery: vi.fn() }));
const submitFeedback = vi.hoisted(() => vi.fn());
const live = vi.hoisted(() => ({ modelSubscribe: vi.fn(), createdSubscribe: vi.fn(), modelUnsubscribe: vi.fn(), createdUnsubscribe: vi.fn() }));
const storage = vi.hoisted(() => ({ getProperties: vi.fn(), getUrl: vi.fn(), uploadData: vi.fn(), remove: vi.fn() }));
const session = vi.hoisted(() => ({ fetchAuthSession: vi.fn() }));

vi.mock('./amplify', () => ({ requireAmplify: vi.fn() }));
vi.mock('./auth', () => ({
  requireUser: () => { if (!state.user) throw new Error('Sign in to Harvest'); return state.user; },
  isAdmin: (user: AuthUser | null) => Boolean(user?.groups.includes('admins')),
}));
vi.mock('aws-amplify/data', () => ({ generateClient: () => ({ models: { Feedback: data }, mutations: { submitFeedback }, subscriptions: { feedbackSubmitted: () => ({ subscribe: live.createdSubscribe }) } }) }));
vi.mock('aws-amplify/auth', () => session);
vi.mock('aws-amplify/storage', () => storage);

const client: AuthUser = { id: 'client-1', email: 'client@company.com', name: 'Client', persona: 'Company', company: 'Company', groups: [] };
const admin: AuthUser = { id: 'admin-1', email: 'admin@meridian.com', name: 'Admin', persona: 'Operator', company: 'Meridian', groups: ['admins'] };
const input: CreateFeedbackInput = { description: '  New report\nMore detail  ', productArea: 'Data room', priority: 'BUG', severity: 'MEDIUM' };
const baseReport: Feedback = {
  id: 'report-1', title: 'New report', description: 'New report\nMore detail', productArea: 'Data room',
  priority: 'BUG', severity: 'MEDIUM', reporterName: client.name, reporterEmail: client.email,
  persona: client.persona, company: client.company, status: 'NEW', owner: 'client-1::client@company.com',
  createdAt: '2026-10-09T09:00:00.000Z', updatedAt: '2026-10-09T09:00:00.000Z',
};
let rows: Feedback[];

beforeEach(() => {
  vi.clearAllMocks();
  state.user = client;
  rows = [{ ...baseReport }];
  data.list.mockImplementation(async () => ({ data: rows, nextToken: null }));
  data.get.mockImplementation(async ({ id }: { id: string }) => ({ data: rows.find(row => row.id === id) ?? null }));
  data.observeQuery.mockReturnValue({ subscribe: live.modelSubscribe });
  live.modelSubscribe.mockReturnValue({ unsubscribe: live.modelUnsubscribe });
  live.createdSubscribe.mockReturnValue({ unsubscribe: live.createdUnsubscribe });
  submitFeedback.mockImplementation(async (record: Partial<Feedback>) => {
    const row: Feedback = { ...baseReport, ...record, id: 'created-1', title: record.description?.split('\n')[0] ?? '',
      reporterName: state.user!.name, reporterEmail: state.user!.email, status: 'NEW' };
    rows.push(row);
    return { data: row };
  });
  data.update.mockImplementation(async (patch: Partial<Feedback>) => {
    const index = rows.findIndex(row => row.id === patch.id);
    if (index < 0) return { data: null };
    rows[index] = { ...rows[index], ...patch, updatedAt: new Date().toISOString() };
    return { data: rows[index] };
  });
  session.fetchAuthSession.mockResolvedValue({ identityId: 'identity-1', tokens: { idToken: { toString: () => 'verified-id-token' } } });
  storage.getProperties.mockResolvedValue({ size: 5 });
  storage.getUrl.mockResolvedValue({ url: new URL('https://example.com/file') });
  storage.uploadData.mockImplementation(({ path }: { path: (input: { identityId: string }) => string }) => ({ result: Promise.resolve({ path: path({ identityId: 'identity-1' }) }) }));
});

it('streams model changes and refetches after secure custom report creation', async () => {
  state.user = admin;
  const onChange = vi.fn();
  const onError = vi.fn();
  const stop = observeAllFeedback(onChange, onError);
  live.modelSubscribe.mock.calls[0][0].next({ items: rows, isSynced: false });
  expect(onChange).not.toHaveBeenCalled();
  live.modelSubscribe.mock.calls[0][0].next({ items: rows, isSynced: true });
  expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'report-1' })]);
  rows.push({ ...baseReport, id: 'report-2' });
  live.createdSubscribe.mock.calls[0][0].next({});
  await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'report-2' })])));
  expect(onError).not.toHaveBeenCalled();
  stop();
  expect(live.modelUnsubscribe).toHaveBeenCalledOnce();
  expect(live.createdUnsubscribe).toHaveBeenCalledOnce();
});

it('requires a signed-in user for every operation', async () => {
  state.user = null;
  for (const operation of [() => createFeedback(input), listMyFeedback, listAllFeedback, () => getFeedback('x'), () => requestUpdate('x'), () => adminUpdate('x', { status: 'NEW' }), () => uploadAttachment(new File([], 'x.png')), () => getAttachmentUrl('x')]) {
    await expect(operation()).rejects.toThrow('Sign in');
  }
});

it('creates a trimmed report using trusted identity and no caller supplied status', async () => {
  const created = await createFeedback({ ...input, status: 'CLOSED', reporterEmail: 'spoof@example.com' } as CreateFeedbackInput);
  expect(created).toMatchObject({ title: 'New report', reporterEmail: client.email, status: 'NEW' });
  expect(submitFeedback).toHaveBeenCalledWith(expect.objectContaining({ description: 'New report\nMore detail', productArea: 'Data room' }), { authToken: 'verified-id-token' });
  expect(submitFeedback.mock.calls[0][0]).not.toHaveProperty('status');
  expect(submitFeedback.mock.calls[0][0]).not.toHaveProperty('reporterEmail');
});

it.each([
  [{ description: ' ' }, 'describe'], [{ description: 'x'.repeat(3001) }, '3000'],
  [{ productArea: 'invalid' }, 'product area'], [{ productArea: 'Other — add an area' }, 'name'],
  [{ productArea: 'Other — add an area', customArea: 'x'.repeat(81) }, '80'],
  [{ priority: 'BOGUS' }, 'priority'], [{ severity: 'BLOCKER' }, 'severity'],
])('rejects invalid report input %o', async (overrides, message) => {
  await expect(createFeedback({ ...input, ...overrides } as CreateFeedbackInput)).rejects.toThrow(message);
  expect(submitFeedback).not.toHaveBeenCalled();
});

it('allows a custom area and reserves Sentry links for admins', async () => {
  expect((await createFeedback({ ...input, productArea: 'Other — add an area', customArea: '  Agreements ' })).customArea).toBe('Agreements');
  await expect(createFeedback({ ...input, sentryIssueId: 'issue-1' })).rejects.toThrow('Admin access');
  state.user = admin;
  expect((await createFeedback({ ...input, sentryIssueId: 'issue-1' })).sentryIssueId).toBe('issue-1');
});

it('follows every data page and scopes My reports to the current owner', async () => {
  const other = { ...baseReport, id: 'report-2', owner: 'other-1::other@company.com', reporterEmail: 'other@company.com' };
  data.list.mockResolvedValueOnce({ data: [baseReport], nextToken: 'page-2' }).mockResolvedValueOnce({ data: [other], nextToken: null });
  expect((await listMyFeedback()).map(row => row.id)).toEqual(['report-1']);
  expect(data.list).toHaveBeenNthCalledWith(2, { limit: 100, nextToken: 'page-2' });
  state.user = admin;
  expect(await listAllFeedback()).toHaveLength(1);
});

it('requires admin access for all-report listing and status changes', async () => {
  await expect(listAllFeedback()).rejects.toThrow('Admin access');
  await expect(adminUpdate('report-1', { status: 'CLOSED' })).rejects.toThrow('Admin access');
  expect(await getFeedback('unknown')).toBeNull();
});

it('keeps update requests pending until an admin saves', async () => {
  const requested = await requestUpdate('report-1');
  expect(isUpdatePending(requested)).toBe(true);
  expect(await requestUpdate('report-1')).toEqual(requested);
  expect(data.update).toHaveBeenCalledTimes(1);
  state.user = admin;
  const updated = await adminUpdate('report-1', { status: 'IN_PROGRESS', assignee: 'admin@example.com' });
  expect(isUpdatePending(updated)).toBe(false);
  expect(Date.parse(updated.adminActivityAt!)).toBeGreaterThan(Date.parse(requested.updateRequestedAt!));
});

it('rejects requests for other owners and closed reports', async () => {
  rows[0].owner = 'other-1::other@company.com';
  rows[0].reporterEmail = 'other@company.com';
  await expect(requestUpdate('report-1')).rejects.toThrow('cannot be requested');
  rows[0].owner = baseReport.owner;
  rows[0].reporterEmail = baseReport.reporterEmail;
  rows[0].status = 'CLOSED';
  await expect(requestUpdate('report-1')).rejects.toThrow('cannot be requested');
});

it('validates admin edits and permits unassignment', async () => {
  state.user = admin;
  await expect(adminUpdate('report-1', { status: 'INVALID' as Feedback['status'] })).rejects.toThrow('valid status');
  const updated = await adminUpdate('report-1', { status: 'ASSIGNED' });
  expect(updated.assignee).toBeUndefined();
  expect(data.update).toHaveBeenCalledWith(expect.objectContaining({ assignee: null }));
});

it('uploads a supported attachment to the owning identity and retrieves its URL', async () => {
  const file = new File(['image'], 'capture.png', { type: 'image/png' });
  const attachment = await uploadAttachment(file);
  expect(attachment.attachmentKey).toMatch(/^feedback-media\/identity-1\//);
  expect(attachment.attachmentSize).toBe(file.size);
  expect(await getAttachmentUrl(attachment.attachmentKey)).toBe('https://example.com/file');
  expect(storage.getUrl).toHaveBeenCalledWith({ path: attachment.attachmentKey, options: { validateObjectExistence: true } });
});

it.each([
  ['x.jpg', 'image/jpeg'], ['x.webp', 'image/webp'], ['x.mp4', 'video/mp4'],
  ['x.webm', 'video/webm;codecs=vp8'], ['x.mov', 'video/quicktime'], ['x.PNG', ''],
])('accepts supported attachment %s', async (name, type) => {
  expect((await uploadAttachment(new File(['x'], name, { type }))).attachmentName).toBe(name);
});

it('rejects unsupported and oversize attachments', async () => {
  for (const file of [new File([], 'x.exe'), new File([], 'x.png', { type: 'text/plain' })]) {
    await expect(uploadAttachment(file)).rejects.toThrow('Use a PNG');
  }
  const large = new File([], 'x.png');
  Object.defineProperty(large, 'size', { value: 50 * 1024 * 1024 + 1 });
  await expect(uploadAttachment(large)).rejects.toThrow('50 MB');
  expect(storage.uploadData).not.toHaveBeenCalled();
});

it('verifies an attachment belongs to the same storage identity before creating a report', async () => {
  await expect(createFeedback({ ...input, attachmentKey: 'feedback-media/other/file', attachmentName: 'x.png', attachmentType: 'image/png' })).rejects.toThrow('Attachment unavailable');
  await createFeedback({ ...input, attachmentKey: 'feedback-media/identity-1/file', attachmentName: 'x.png', attachmentType: 'image/png' });
  expect(submitFeedback).toHaveBeenCalledWith(expect.objectContaining({ attachmentSize: 5 }), { authToken: 'verified-id-token' });
});

it('surfaces data and storage errors without claiming success', async () => {
  submitFeedback.mockResolvedValueOnce({ data: null, errors: [{ message: 'Write failed' }] });
  await expect(createFeedback(input)).rejects.toThrow('Write failed');
  storage.getUrl.mockRejectedValueOnce(new Error('missing'));
  await expect(getAttachmentUrl('missing')).rejects.toThrow('Attachment unavailable');
});

it('rejects an attachment already claimed by one of the reporter’s reports', async () => {
  rows[0].attachmentKey = 'feedback-media/identity-1/file';
  await expect(createFeedback({ ...input, attachmentKey: rows[0].attachmentKey, attachmentName: 'x.png', attachmentType: 'image/png' })).rejects.toThrow('Attachment unavailable');
  expect(submitFeedback).not.toHaveBeenCalled();
});

it('passes list errors to the page instead of showing an empty result', async () => {
  data.list.mockResolvedValueOnce({ data: [], errors: [{ message: 'Data service unavailable' }] });
  await expect(listMyFeedback()).rejects.toThrow('Data service unavailable');
});

it('lets the reporter request another update immediately after an admin reply', async () => {
  await requestUpdate('report-1');
  state.user = admin;
  await adminUpdate('report-1', { status: 'ASSIGNED' });
  state.user = client;
  const requestedAgain = await requestUpdate('report-1');
  expect(isUpdatePending(requestedAgain)).toBe(true);
  expect(data.update).toHaveBeenCalledTimes(3);
});

it('removes only an unclaimed upload owned by the current storage identity', async () => {
  await expect(removeAttachment('feedback-media/other/file')).rejects.toThrow('unavailable');
  rows[0].attachmentKey = 'feedback-media/identity-1/claimed';
  await expect(removeAttachment(rows[0].attachmentKey)).rejects.toThrow('already attached');
  expect(storage.remove).not.toHaveBeenCalled();
  await removeAttachment('feedback-media/identity-1/orphan');
  expect(storage.remove).toHaveBeenCalledWith({ path: 'feedback-media/identity-1/orphan' });
  data.list.mockResolvedValueOnce({ data: [], errors: [{ message: 'Unavailable' }] });
  await expect(removeAttachment('feedback-media/identity-1/uncertain')).rejects.toThrow('Unavailable');
  expect(storage.remove).toHaveBeenCalledTimes(1);
});

it('subscribes to synced own reports and releases the subscription', () => {
  const unsubscribe = vi.fn(), next = vi.fn(), error = vi.fn();
  const subscribe = vi.fn();
  data.observeQuery.mockReturnValue({ subscribe });
  subscribe.mockReturnValue({ unsubscribe });
  const stop = subscribeMyFeedback(next, error);
  const observer = subscribe.mock.calls[0][0];
  observer.next({ items: [baseReport], isSynced: false });
  expect(next).not.toHaveBeenCalled();
  observer.next({ items: [baseReport, { ...baseReport, owner: 'another', reporterEmail: 'other@example.com' }], isSynced: true });
  expect(next).toHaveBeenCalledWith([baseReport]);
  observer.error(); expect(error).toHaveBeenCalledOnce();
  stop(); expect(unsubscribe).toHaveBeenCalledOnce();
});
