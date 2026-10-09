import { adminUpdate, createFeedback, getAttachmentUrl, getFeedback, listAllFeedback, listMyFeedback, requestUpdate, uploadAttachment } from './feedback';
import { confirmSignIn, signIn, signOut } from './auth';
import { isUpdatePending } from './status';
import type { CreateFeedbackInput } from './types';
import { installIndexedDb } from '../test/indexedDb';

const input: CreateFeedbackInput = { description: '  New report\nMore detail  ', productArea: 'Data room', priority: 'BUG', severity: 'MEDIUM' };
async function login(email = 'company@example.com') { await signIn(email); return confirmSignIn('123456'); }
beforeEach(() => { installIndexedDb(); });

it('requires authentication for all API functions', async () => {
  for (const operation of [() => createFeedback(input), listMyFeedback, listAllFeedback, () => getFeedback('x'), () => requestUpdate('x'), () => adminUpdate('x', { status: 'NEW' }), () => uploadAttachment(new File([], 'x.png')), () => getAttachmentUrl('x')]) {
    await expect(operation()).rejects.toThrow('Sign in');
  }
});
it('seeds the prototype reports once, with valid enums, all progress states and missing attachment metadata', async () => {
  await login(); const mine = await listMyFeedback(); expect(mine).toHaveLength(5);
  expect(new Set(mine.map(r => r.status))).toEqual(new Set(['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED']));
  expect(mine.every(r => r.owner === 'company@example.com')).toBe(true);
  expect(mine.find(r => r.status === 'CLOSED')).toMatchObject({ attachmentName: 'filename-overlap.png', severity: 'LOW' });
  expect(mine.find(r => r.customArea === 'Agreements')?.productArea).toBe('Other — add an area');
  expect(mine.some(isUpdatePending)).toBe(true);
  expect(await listMyFeedback()).toEqual(mine);
  await login('admin@example.com'); expect(await listAllFeedback()).toHaveLength(12);
  expect(await listAllFeedback()).toEqual(await listAllFeedback());
  expect((await listAllFeedback()).at(-1)?.status).toBe('CLOSED');
});
it('creates a trimmed report with trusted identity/defaults and persists it across module reloads', async () => {
  const user = await login();
  const report = await createFeedback({ ...input, title: 'spoofed', status: 'CLOSED', reporterEmail: 'other@example.com', owner: 'other' } as CreateFeedbackInput);
  expect(report).toMatchObject({ title: 'New report', description: 'New report\nMore detail', reporterEmail: user.email, owner: user.id, status: 'NEW', company: 'Northstar Company' });
  vi.resetModules(); const reloaded = await import('./feedback'); expect(await reloaded.getFeedback(report.id)).toEqual(report);
  expect((await reloaded.listMyFeedback())[0].id).toBe(report.id);
});
it('scopes client reads, denies admin writes and lets admins access all reports', async () => {
  await login(); const report = await createFeedback(input);
  await expect(listAllFeedback()).rejects.toThrow('Admin access');
  await expect(adminUpdate(report.id, { status: 'CLOSED' })).rejects.toThrow('Admin access');
  await login('other@example.com'); expect(await getFeedback(report.id)).toBeNull();
  expect((await listMyFeedback()).every(r => r.owner === 'other@example.com')).toBe(true);
  await expect(requestUpdate(report.id)).rejects.toThrow('unavailable');
  await login('admin@example.com'); expect(await getFeedback(report.id)).toEqual(report);
  expect(await getFeedback('unknown')).toBeNull();
  await expect(adminUpdate('unknown', { status: 'NEW' })).rejects.toThrow('unavailable');
  await expect(requestUpdate(report.id)).rejects.toThrow('cannot be requested');
  expect(await listMyFeedback()).toEqual([]);
});
it('keeps a request pending until an admin saves, then permits another request; closed reports cannot request', async () => {
  await login(); const report = await createFeedback(input);
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  const requested = await requestUpdate(report.id); expect(isUpdatePending(requested)).toBe(true);
  expect((await requestUpdate(report.id)).updateRequestedAt).toBe(requested.updateRequestedAt);
  await login('admin@example.com');
  const updated = await adminUpdate(report.id, { status: 'ASSIGNED', assignee: 'admin@example.com' });
  expect(isUpdatePending(updated)).toBe(false); expect(Date.parse(updated.adminActivityAt!)).toBeGreaterThan(Date.parse(requested.updateRequestedAt!));
  await adminUpdate(report.id, { status: 'IN_PROGRESS' }); expect((await getFeedback(report.id))?.assignee).toBeUndefined();
  vi.advanceTimersByTime(1000); await login(); expect(isUpdatePending(await requestUpdate(report.id))).toBe(true);
  await login('admin@example.com'); await adminUpdate(report.id, { status: 'CLOSED' });
  await login(); await expect(requestUpdate(report.id)).rejects.toThrow('cannot be requested');
});
it.each([
  [{ description: ' ' }, 'describe'], [{ description: 'x'.repeat(3001) }, '3000'],
  [{ productArea: 'invalid' }, 'product area'], [{ productArea: 'Other — add an area' }, 'name'],
  [{ productArea: 'Other — add an area', customArea: 'x'.repeat(81) }, '80'],
  [{ priority: 'BOGUS' }, 'priority'], [{ severity: 'BLOCKER' }, 'severity'],
])('validates report inputs %o', async (overrides, message) => { await login(); await expect(createFeedback({ ...input, ...overrides } as CreateFeedbackInput)).rejects.toThrow(message); });
it('supports Other, strips irrelevant custom areas and reserves Sentry links for admins', async () => {
  await login(); expect((await createFeedback({ ...input, productArea: 'Other — add an area', customArea: '  Agreements  ' })).customArea).toBe('Agreements');
  expect((await createFeedback({ ...input, customArea: 'irrelevant' })).customArea).toBeUndefined();
  await expect(createFeedback({ ...input, sentryIssueId: 'issue-1' })).rejects.toThrow('Admin access');
  await login('admin@example.com'); expect((await createFeedback({ ...input, sentryIssueId: 'issue-1' })).sentryIssueId).toBe('issue-1');
  await expect(adminUpdate((await listAllFeedback())[0].id, { status: 'invalid' } as never)).rejects.toThrow('valid status');
  await expect(adminUpdate((await listAllFeedback())[0].id, { status: 'NEW', assignee: 'unknown' })).rejects.toThrow('valid status');
});
it('round-trips a blob through IndexedDB and supplies attachment metadata from storage', async () => {
  const db = installIndexedDb(); await login();
  const file = new File(['image bytes'], 'capture.png', { type: 'image/png' });
  const attachment = await uploadAttachment(file); expect(attachment.attachmentKey).toMatch(/^feedback-media\/company%40example.com\//);
  expect(db.records.get(attachment.attachmentKey)).toMatchObject({ file, owner: 'company@example.com' });
  const report = await createFeedback({ ...input, ...attachment, attachmentName: 'spoofed' });
  expect(report).toMatchObject({ attachmentName: 'capture.png', attachmentSize: file.size, attachmentType: 'image/png' });
  expect(await getAttachmentUrl(attachment.attachmentKey)).toBe('blob:mock-media'); expect(URL.createObjectURL).toHaveBeenCalledWith(file);
  vi.resetModules(); expect(await (await import('./feedback')).getAttachmentUrl(attachment.attachmentKey)).toBe('blob:mock-media');
  await expect(createFeedback({ ...input, ...attachment })).rejects.toThrow('unavailable');
  await login('other@example.com'); await expect(getAttachmentUrl(attachment.attachmentKey)).rejects.toThrow('unavailable');
  await expect(createFeedback({ ...input, ...attachment })).rejects.toThrow('unavailable');
  await login('admin@example.com'); expect(await getAttachmentUrl(attachment.attachmentKey)).toBe('blob:mock-media');
  await expect(getAttachmentUrl('missing')).rejects.toThrow('unavailable');
  await expect(getAttachmentUrl((await listAllFeedback()).find(r => r.attachmentName === 'sign-step.png')!.attachmentKey!)).rejects.toThrow('unavailable');
});
it('preserves concurrent attachment creates and prevents two reports from claiming one file', async () => {
  await login();
  const [first, second] = await Promise.all([
    uploadAttachment(new File(['a'], 'a.png', { type: 'image/png' })),
    uploadAttachment(new File(['b'], 'b.png', { type: 'image/png' })),
  ]);
  const reports = await Promise.all([createFeedback({ ...input, ...first }), createFeedback({ ...input, ...second })]);
  expect((await listMyFeedback()).filter(report => reports.some(created => created.id === report.id))).toHaveLength(2);
  const third = await uploadAttachment(new File(['c'], 'c.png', { type: 'image/png' }));
  const results = await Promise.allSettled([createFeedback({ ...input, ...third }), createFeedback({ ...input, ...third })]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
});
it('can request again immediately after an admin clears a pending request', async () => {
  await login(); const report = await createFeedback(input);
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  await requestUpdate(report.id); await login('admin@example.com'); await adminUpdate(report.id, { status: 'IN_PROGRESS' });
  await login(); expect(isUpdatePending(await requestUpdate(report.id))).toBe(true);
});
it.each([
  ['x.jpg', 'image/jpeg'], ['x.jpeg', 'image/jpeg'], ['x.webp', 'image/webp'],
  ['x.mp4', 'video/mp4'], ['x.webm', 'video/webm;codecs=vp8'], ['x.mov', 'video/quicktime'], ['x.PNG', ''],
])('accepts supported attachment %s', async (name, type) => { await login(); expect((await uploadAttachment(new File(['x'], name, { type }))).attachmentName).toBe(name); });
it('rejects unsupported files, oversize files and unavailable storage', async () => {
  await login();
  for (const file of [new File([], 'x.exe'), new File([], 'no-extension'), new File([], 'x.png', { type: 'text/plain' })]) await expect(uploadAttachment(file)).rejects.toThrow('Use a PNG');
  const file = new File([], 'x.png', { type: 'image/png' }); Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 + 1 }); await expect(uploadAttachment(file)).rejects.toThrow('50 MB');
  await expect(createFeedback({ ...input, attachmentKey: 'missing' })).rejects.toThrow('unavailable');
  const db = installIndexedDb(); db.failWrite(); await expect(uploadAttachment(new File(['x'], 'x.png'))).rejects.toThrow('Write failed');
  const broken = installIndexedDb(); broken.failOpen(); await expect(getAttachmentUrl('anything')).rejects.toThrow('Open failed');
});
it('reports localStorage failures without claiming success', async () => {
  await login(); await listMyFeedback();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); }); await expect(createFeedback(input)).rejects.toThrow('Quota');
});
it('refuses incompatible stored records', async () => {
  await login(); localStorage.setItem('harvest-feedback-mock-v1', '{"version":2}'); await expect(listMyFeedback()).rejects.toThrow('storage is unavailable'); await signOut();
});
