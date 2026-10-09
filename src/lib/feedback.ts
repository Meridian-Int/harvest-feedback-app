import { isAdmin, requireUser } from './auth';
import { titleFromDescription } from './format';
import { sortFeedback } from './list';
import { ASSIGNEES, MAX_ATTACHMENT_BYTES, PRODUCT_AREAS, PRIORITY_LABELS, SEVERITY_LABELS, STATUS_ORDER } from './options';
import { isUpdatePending } from './status';
import type { AdminUpdateInput, Attachment, AuthUser, CreateFeedbackInput, Feedback, Persona, Severity, Status } from './types';

/** DEVELOPMENT ONLY. Replace this file's implementation with Amplify; keep its contracts. */
export type { AdminUpdateInput, Attachment, CreateFeedbackInput, Feedback } from './types';
const DATA_KEY = 'harvest-feedback-mock-v1';
const DB_NAME = 'harvest-feedback-mock-media';
const STORE_NAME = 'files';

interface MockState { version: 1; reports: Feedback[]; seededUsers: string[] }
interface StoredFile { key: string; owner: string; file: Blob; name: string; type: string; size: number }
interface PrototypeReport {
  id?: string; suffix?: string; p: string; severity?: string; t: string; body: string;
  g: string; u: Persona; r?: string; f: string; date: string; status: string;
  assignee?: string; activity?: { author: string; text: string; role: string; kind: string; date: string }[];
}

function adaptSample(row: PrototypeReport, user?: AuthUser): Feedback {
  const owner = user?.id ?? `${row.r?.toLowerCase() ?? 'client'}@example.com`;
  const priority = ({ Blocker: 'BLOCKER', Bug: 'BUG', Improvement: 'IMPROVEMENT' } as const)[row.p as 'Blocker' | 'Bug' | 'Improvement'];
  const severity: Severity = row.severity === 'Low' ? 'LOW' : row.severity === 'Normal' || priority === 'IMPROVEMENT' ? 'MEDIUM' : 'CRITICAL';
  const originalStatus = row.id === 'HF-005' ? 'Assigned' : row.status;
  const statuses: Record<string, Status> = { New: 'NEW', Assigned: 'ASSIGNED', 'In progress': 'IN_PROGRESS', Closed: 'CLOSED', Resolved: 'CLOSED' };
  const status = statuses[originalStatus];
  const id = user ? `demo-${encodeURIComponent(user.id)}-00${row.suffix}` : `seed-0${row.id!.slice(-3)}`;
  const supportedArea = PRODUCT_AREAS.includes(row.g as typeof PRODUCT_AREAS[number]);
  const createdAt = new Date(`${row.date}Z`).toISOString();
  const adminActivityAt = row.activity?.filter(a => a.role === 'Admin').at(-1)?.date;
  const updateRequestedAt = row.activity?.filter(a => a.kind === 'update-request').at(-1)?.date;
  return {
    id, title: row.t, description: `${row.t}\n${row.body}`, productArea: supportedArea ? row.g : 'Other — add an area',
    ...(supportedArea ? {} : { customArea: row.g }), priority, severity, status,
    reporterName: user?.name ?? row.r!, reporterEmail: user?.email ?? owner,
    persona: user?.persona ?? row.u, company: user?.company ?? (row.u === 'Company' ? 'Northstar Company' : row.u === 'Partner' ? 'Meridian Partner' : 'Meridian Operations'),
    owner, createdAt, updatedAt: createdAt,
    ...(status !== 'NEW' ? { assignee: 'admin@example.com' } : {}),
    ...(adminActivityAt ? { adminActivityAt: new Date(`${adminActivityAt}Z`).toISOString() } : {}),
    ...(updateRequestedAt ? { updateRequestedAt: new Date(`${updateRequestedAt}Z`).toISOString() } : {}),
    // Filenames are metadata only: the handoff does not include attachment binaries.
    ...(row.f ? { attachmentKey: `feedback-media/${encodeURIComponent(owner)}/sample-${id}`, attachmentName: row.f,
      attachmentType: row.f.endsWith('.mov') ? 'video/quicktime' : 'image/png' } : {}),
  };
}

function save(state: MockState): void {
  // Fail explicitly instead of claiming persistence succeeded when storage is full/blocked.
  localStorage.setItem(DATA_KEY, JSON.stringify(state));
}

function load(user: AuthUser): MockState {
  const stored = localStorage.getItem(DATA_KEY);
  let state: MockState;
  if (stored) {
    state = JSON.parse(stored) as MockState;
    if (state.version !== 1 || !Array.isArray(state.reports) || !Array.isArray(state.seededUsers)) {
      throw new Error('Feedback storage is unavailable.');
    }
  } else {
    state = { version: 1, reports: ORIGINAL_REPORTS.map(row => adaptSample(row)), seededUsers: [] };
  }
  if (!isAdmin(user) && !state.seededUsers.includes(user.id)) {
    state.reports.push(...SAMPLE_REPORTS.map(row => adaptSample(row, user)));
    state.seededUsers.push(user.id);
    save(state);
  } else if (!stored) save(state);
  return state;
}

function requireAdmin(user: AuthUser): void {
  if (!isAdmin(user)) throw new Error('Admin access required.');
}

function findReport(state: MockState, id: string, user: AuthUser): Feedback {
  const report = state.reports.find(item => item.id === id);
  if (!report || (!isAdmin(user) && report.owner !== user.id)) throw new Error('Report unavailable.');
  return report;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE_NAME, { keyPath: 'key' }); };
    request.onerror = () => reject(request.error ?? new Error('Attachment storage is unavailable.'));
    request.onblocked = () => reject(new Error('Attachment storage is unavailable.'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function readFile(key: string): Promise<StoredFile | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key);
    let result: StoredFile | undefined;
    request.onsuccess = () => { result = request.result as StoredFile | undefined; };
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('Attachment storage is unavailable.')); };
  });
}

async function writeFile(record: StoredFile): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('Attachment storage is unavailable.')); };
  });
}

export async function createFeedback(input: CreateFeedbackInput): Promise<Feedback> {
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
    const stored = await readFile(input.attachmentKey);
    if (!stored || stored.owner !== user.id) throw new Error('Attachment unavailable.');
    attachment = { attachmentKey: stored.key, attachmentName: stored.name, attachmentType: stored.type, attachmentSize: stored.size };
  }
  // Read the latest state after the async file lookup so concurrent creates cannot overwrite one another.
  const state = load(user);
  if (attachment && state.reports.some(report => report.attachmentKey === attachment.attachmentKey)) throw new Error('Attachment unavailable.');
  const now = new Date().toISOString();
  const report: Feedback = {
    id: crypto.randomUUID(), title: titleFromDescription(description), description, productArea: input.productArea,
    ...(input.productArea === 'Other — add an area' ? { customArea } : {}), priority: input.priority, severity: input.severity,
    reporterName: user.name, reporterEmail: user.email, persona: user.persona, company: user.company,
    owner: user.id, status: 'NEW', createdAt: now, updatedAt: now,
    ...(input.sentryIssueId ? { sentryIssueId: input.sentryIssueId } : {}), ...attachment,
  };
  state.reports.push(report);
  save(state);
  return report;
}

export async function listMyFeedback(): Promise<Feedback[]> {
  const user = requireUser();
  return sortFeedback(load(user).reports.filter(report => report.owner === user.id));
}

export async function listAllFeedback(): Promise<Feedback[]> {
  const user = requireUser();
  requireAdmin(user);
  return sortFeedback(load(user).reports);
}

export async function getFeedback(id: string): Promise<Feedback | null> {
  const user = requireUser();
  const state = load(user);
  const report = state.reports.find(item => item.id === id);
  return report && (isAdmin(user) || report.owner === user.id) ? report : null;
}

export async function requestUpdate(id: string): Promise<Feedback> {
  const user = requireUser();
  const state = load(user);
  const report = findReport(state, id, user);
  if (report.owner !== user.id || report.status === 'CLOSED') throw new Error('An update cannot be requested for this report.');
  if (!isUpdatePending(report)) {
    const now = new Date(Math.max(Date.now(), report.adminActivityAt ? Date.parse(report.adminActivityAt) + 1 : 0)).toISOString();
    report.updateRequestedAt = now;
    report.updatedAt = now;
    save(state);
  }
  return report;
}

export async function adminUpdate(id: string, input: AdminUpdateInput): Promise<Feedback> {
  const user = requireUser();
  requireAdmin(user);
  if (!STATUS_ORDER.includes(input.status) || (input.assignee && !ASSIGNEES.some(a => a.value === input.assignee))) throw new Error('Please choose a valid status and owner.');
  const state = load(user);
  const report = findReport(state, id, user);
  report.status = input.status;
  report.assignee = input.assignee || undefined;
  // Keep the timestamp strictly later even if an admin responds within the same millisecond.
  report.adminActivityAt = new Date(Math.max(Date.now(), Date.parse(report.updateRequestedAt ?? '') + 1 || 0)).toISOString();
  report.updatedAt = report.adminActivityAt;
  save(state);
  return report;
}

export async function uploadAttachment(file: File): Promise<Attachment> {
  const user = requireUser();
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  const mime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
  if (!extension || !Object.hasOwn(mime, extension) || (file.type && !['', mime[extension]].includes(file.type.split(';', 1)[0]))) throw new Error('Use a PNG, JPG, WebP image or an MP4, WebM or MOV recording.');
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('Keep the attachment under 50 MB.');
  const key = `feedback-media/${encodeURIComponent(user.id)}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const type = file.type || mime[extension];
  await writeFile({ key, owner: user.id, file, name: file.name, type, size: file.size });
  return { attachmentKey: key, attachmentName: file.name, attachmentType: type, attachmentSize: file.size };
}

/** Caller owns the object URL and must URL.revokeObjectURL when its preview/download closes. */
export async function getAttachmentUrl(key: string): Promise<string> {
  const user = requireUser();
  const stored = await readFile(key);
  if (!stored || (!isAdmin(user) && stored.owner !== user.id)) throw new Error('Attachment unavailable.');
  return URL.createObjectURL(stored.file);
}

// Exact prototype fixtures, adapted to the application schema above.
const ORIGINAL_REPORTS: PrototypeReport[] = [
  {
    "id": "HF-007",
    "p": "Blocker",
    "t": "QuickBooks connection never opens",
    "body": "The Connect button on the Data room keeps spinning and never opens the sign-in card for QuickBooks. I expected to see the QuickBooks authorization screen.",
    "g": "Data room",
    "u": "Company",
    "r": "Vaish",
    "f": "connect-spinner.mov",
    "date": "2026-10-08T11:20:00",
    "status": "New"
  },
  {
    "id": "HF-006",
    "p": "Bug",
    "t": "Agreement stays on the signature step",
    "body": "After signing the agreement, the page stays on the signature step until a manual reload. The next step should open automatically.",
    "g": "Agreements",
    "u": "Company",
    "r": "Manasa",
    "f": "sign-step.png",
    "date": "2026-10-08T10:42:00",
    "status": "In progress"
  },
  {
    "id": "HF-005",
    "p": "Improvement",
    "t": "Show the company budget during invitations",
    "body": "Show the Company Budget next to the Fee field while inviting a company. It would help us choose the right fee without switching pages.",
    "g": "Partner portfolio",
    "u": "Partner",
    "r": "Manasa",
    "f": "",
    "date": "2026-10-08T09:58:00",
    "status": "New"
  },
  {
    "id": "HF-004",
    "p": "Bug",
    "t": "Duplicate company in payments due",
    "body": "The Payments due list shows the same company twice after marking a payment as sent.",
    "g": "Payments",
    "u": "Operator",
    "r": "Vaish",
    "f": "payments-due.png",
    "date": "2026-10-07T17:31:00",
    "status": "New"
  },
  {
    "id": "HF-003",
    "p": "Blocker",
    "t": "Invitation opens the wrong page",
    "body": "The invitation link opens the enquiry page even though the link is one day old. The partner cannot finish joining.",
    "g": "Onboarding",
    "u": "Partner",
    "r": "Vaish",
    "f": "invite-link.png",
    "date": "2026-10-07T15:04:00",
    "status": "In progress"
  },
  {
    "id": "HF-002",
    "p": "Improvement",
    "t": "Show the last operator on queue rows",
    "body": "Queue rows could show which operator last touched the case, so we can follow up with the right person.",
    "g": "Operations console",
    "u": "Operator",
    "r": "Manasa",
    "f": "",
    "date": "2026-10-07T12:15:00",
    "status": "New"
  },
  {
    "id": "HF-001",
    "p": "Bug",
    "t": "Upload progress resets when tab loses focus",
    "body": "Upload progress resets to zero when the tab loses focus during a large file. The upload itself continues, but the progress display is confusing.",
    "g": "Data room",
    "u": "Company",
    "r": "Manasa",
    "f": "upload-reset.mov",
    "date": "2026-10-06T16:47:00",
    "status": "Resolved"
  }
];
const SAMPLE_REPORTS: PrototypeReport[] = [
  {
    "suffix": "01",
    "p": "Blocker",
    "severity": "High",
    "t": "QuickBooks connection stops at authorization",
    "body": "Selecting Connect opens a blank authorization window. Our finance team cannot finish connecting QuickBooks.",
    "g": "Data room",
    "u": "Company",
    "status": "New",
    "assignee": "",
    "f": "authorization-window.png",
    "date": "2026-10-08T16:40:00",
    "activity": []
  },
  {
    "suffix": "02",
    "p": "Improvement",
    "severity": "Normal",
    "t": "Show a summary before submitting the data room",
    "body": "A summary of connected sources and uploaded files would help our team check everything before submitting.",
    "g": "Data room",
    "u": "Company",
    "status": "Assigned",
    "assignee": "Vaish",
    "f": "",
    "date": "2026-10-08T15:20:00",
    "activity": [
      {
        "author": "Vaish",
        "role": "Admin",
        "kind": "workflow",
        "text": "Assigned to Vaish for product review. We are reviewing the proposed summary with the design team.",
        "date": "2026-10-08T16:00:00"
      }
    ]
  },
  {
    "suffix": "03",
    "p": "Bug",
    "severity": "High",
    "t": "Signed agreement does not advance to the next screen",
    "body": "The agreement is marked as signed, but the page remains on the signature screen. Refreshing the page opens the next step.",
    "g": "Agreements",
    "u": "Company",
    "status": "In progress",
    "assignee": "Manasa",
    "f": "signature-screen.png",
    "date": "2026-10-08T14:10:00",
    "activity": [
      {
        "author": "Manasa",
        "role": "Admin",
        "kind": "workflow",
        "text": "Issue reproduced. The team is updating the redirect after signing.",
        "date": "2026-10-08T15:00:00"
      }
    ]
  },
  {
    "suffix": "04",
    "p": "Bug",
    "severity": "Low",
    "t": "Long filenames overlap the upload status label",
    "body": "A long filename overlaps the upload status label in the file list. The file uploads successfully.",
    "g": "Data room",
    "u": "Company",
    "status": "Closed",
    "assignee": "Vaish",
    "f": "filename-overlap.png",
    "date": "2026-10-08T12:30:00",
    "activity": [
      {
        "author": "Vaish",
        "role": "Admin",
        "kind": "workflow",
        "text": "Fixed the filename truncation and verified the layout on desktop and mobile. This report is now closed.",
        "date": "2026-10-08T14:00:00"
      }
    ]
  },
  {
    "suffix": "05",
    "p": "Bug",
    "severity": "Normal",
    "t": "Payment confirmation takes a long time to appear",
    "body": "The payment is shown as sent, but the confirmation message takes several minutes to appear.",
    "g": "Payments",
    "u": "Company",
    "status": "In progress",
    "assignee": "Vaish",
    "f": "",
    "date": "2026-10-08T11:15:00",
    "activity": [
      {
        "author": "Vaish",
        "role": "Admin",
        "kind": "workflow",
        "text": "Investigating the delay between the payment status and confirmation message.",
        "date": "2026-10-08T12:00:00"
      },
      {
        "author": "Client",
        "role": "Client",
        "kind": "update-request",
        "text": "Requested a progress update. This is a sample request; no notification was sent.",
        "date": "2026-10-08T16:15:00"
      }
    ]
  }
];
