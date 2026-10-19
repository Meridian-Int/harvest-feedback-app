import { createHash } from 'node:crypto';

export interface LinearTeam { id: string; name: string; key: string }
export interface LinearIssue { id: string; identifier: string; url: string }
export interface LinearUploadedFile { name: string; url: string }
export interface LinearReport {
  id: string;
  title: string;
  description: string;
  productArea: string;
  customArea?: string;
  priority: 'BLOCKER' | 'BUG' | 'IMPROVEMENT';
  linearTeamId: string;
  linearAssigneeEmail?: string;
  attachmentKey?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
  attachments?: Array<{ attachmentKey: string; attachmentName: string; attachmentType: string; attachmentSize: number }>;
}

const endpoint = 'https://api.linear.app/graphql';
class LinearNotFoundError extends Error {}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function linearIssueId(reportId: string): string {
  const hash = createHash('sha256').update(`harvest-feedback:${reportId}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function linearDescription(report: LinearReport, appBaseUrl: string, files: LinearUploadedFile[] = []): string {
  const base = new URL(appBaseUrl);
  if (base.protocol !== 'https:' || base.pathname !== '/feedback' || base.search || base.hash) throw new Error('Invalid Feedback issue link.');
  const link = new URL('/feedback/admin/reviews', base);
  link.searchParams.set('report', report.id);
  const area = report.customArea || report.productArea;
  const quote = report.description.trim().split(/\r?\n/).map(line => `> ${line || ' '}`).join('\n');
  const attachments = files.length ? `\n\n## Attachments\n${files.map(file => {
    const url = new URL(file.url);
    if (url.protocol !== 'https:' || url.hostname !== 'uploads.linear.app') throw new Error('Invalid Linear attachment URL.');
    const name = file.name.replace(/[\\\[\]\r\n]/g, '_');
    return `- [${name}](${url.href})`;
  }).join('\n')}` : '';
  return `Source: HARVEST Feedback\nFeedback report (support): ${link.href}\n\n## Context\nProduct area: ${area}\nPriority: ${report.priority}\n\n## Reported behavior\n${quote}${attachments}`;
}

export function linearPriority(priority: LinearReport['priority']): number {
  return { BLOCKER: 1, BUG: 2, IMPROVEMENT: 3 }[priority];
}

export async function linearRequest<T>(query: string, variables: Record<string, unknown>, token: string, request: typeof fetch = fetch): Promise<T> {
  if (!token) throw new Error('Linear is not configured.');
  const response = await request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length) {
    if (body.errors.every(error => /not found|could not find|does not exist/i.test(error.message))) throw new LinearNotFoundError('Linear issue was not found.');
    if (body.errors.some(error => /invalid scope.*`write` required/i.test(error.message))) throw new Error('Linear API key needs Write permission.');
    throw new Error('Linear API rejected the request.');
  }
  if (!response.ok) throw new Error(`Linear API returned HTTP ${response.status}.`);
  if (!body.data) throw new Error('Linear API returned no data.');
  return body.data;
}

/** Transfer one verified Feedback file into Linear's private file storage. */
export async function uploadLinearFile(file: { name: string; type: string; bytes: Uint8Array }, token: string, request: typeof fetch = fetch): Promise<LinearUploadedFile> {
  const data: { fileUpload: { success: boolean; uploadFile?: { uploadUrl: string; assetUrl: string; headers: Array<{ key: string; value: string }> } } } = await linearRequest(
    'mutation FeedbackFileUpload($filename: String!, $contentType: String!, $size: Int!) { fileUpload(filename: $filename, contentType: $contentType, size: $size) { success uploadFile { uploadUrl assetUrl headers { key value } } } }',
    { filename: file.name, contentType: file.type, size: file.bytes.byteLength }, token, request,
  );
  const upload = data.fileUpload?.uploadFile;
  if (!data.fileUpload?.success || !upload || !Array.isArray(upload.headers)) throw new Error('Linear file upload was not prepared.');
  const destination = new URL(upload.uploadUrl);
  const asset = new URL(upload.assetUrl);
  if (destination.protocol !== 'https:' || destination.username || destination.password || asset.protocol !== 'https:' || asset.hostname !== 'uploads.linear.app') throw new Error('Linear returned an invalid upload URL.');
  const headers = new Headers({ 'Content-Type': file.type, 'Cache-Control': 'public, max-age=31536000' });
  for (const header of upload.headers) headers.set(header.key, header.value);
  const result = await request(destination.href, { method: 'PUT', headers, body: Buffer.from(file.bytes), signal: AbortSignal.timeout(120_000) });
  if (!result.ok) throw new Error(`Linear file upload returned HTTP ${result.status}.`);
  return { name: file.name, url: asset.href };
}

export async function listLinearTeams(token: string, request: typeof fetch = fetch): Promise<LinearTeam[]> {
  const teams: LinearTeam[] = [];
  let after: string | null = null;
  do {
    const data: { teams: { nodes: LinearTeam[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } = await linearRequest(
      'query FeedbackTeams($after: String) { teams(first: 100, after: $after) { nodes { id name key } pageInfo { hasNextPage endCursor } } }',
      { after }, token, request,
    );
    if (!data.teams?.nodes || !data.teams.pageInfo) throw new Error('Linear returned an incomplete team list.');
    teams.push(...data.teams.nodes.filter(team => uuid.test(team.id)));
    after = data.teams.pageInfo.hasNextPage ? data.teams.pageInfo.endCursor : null;
    if (data.teams.pageInfo.hasNextPage && !after) throw new Error('Linear returned an invalid team cursor.');
  } while (after);
  return teams.sort((a, b) => a.name.localeCompare(b.name));
}

export async function linearAssigneeId(email: string | undefined, token: string, request: typeof fetch = fetch): Promise<string | undefined> {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();
  const alias = normalized.match(/^([^@+]+)\+[^@]+@([^@]+)$/);
  const baseEmail = alias ? `${alias[1]}@${alias[2]}` : undefined;
  let fallbackId: string | undefined;
  let after: string | null = null;
  do {
    const data: { users: { nodes: Array<{ id: string; email: string; active: boolean; isAssignable: boolean }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } = await linearRequest(
      'query FeedbackUsers($after: String) { users(first: 100, after: $after) { nodes { id email active isAssignable } pageInfo { hasNextPage endCursor } } }',
      { after }, token, request,
    );
    if (!data.users?.nodes || !data.users.pageInfo) throw new Error('Linear returned an incomplete user list.');
    const eligible = (candidate: typeof data.users.nodes[number]) => candidate.active === true && candidate.isAssignable === true && uuid.test(candidate.id);
    const user = data.users.nodes.find(candidate => candidate.email?.trim().toLowerCase() === normalized && eligible(candidate));
    if (user) return user.id;
    if (baseEmail && !fallbackId) fallbackId = data.users.nodes.find(candidate => candidate.email?.trim().toLowerCase() === baseEmail && eligible(candidate))?.id;
    after = data.users.pageInfo.hasNextPage ? data.users.pageInfo.endCursor : null;
    if (data.users.pageInfo.hasNextPage && !after) throw new Error('Linear returned an invalid user cursor.');
  } while (after);
  return fallbackId;
}

/** Keep an existing issue's assignee aligned with the Feedback owner. */
export async function updateLinearAssignee(issueId: string, email: string | undefined, token: string, request: typeof fetch = fetch): Promise<void> {
  if (!uuid.test(issueId)) throw new Error('Invalid Linear issue.');
  const assigneeId = await linearAssigneeId(email, token, request);
  if (email && !assigneeId) throw new Error('Feedback owner has no assignable Linear account.');
  const data: { issueUpdate: { success: boolean; issue?: { id: string; assignee?: { id: string } | null } | null } } = await linearRequest(
    'mutation UpdateFeedbackAssignee($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id assignee { id } } } }',
    { id: issueId, input: { assigneeId: assigneeId ?? null } }, token, request,
  );
  if (!data.issueUpdate?.success || data.issueUpdate.issue?.id !== issueId || (data.issueUpdate.issue.assignee?.id ?? null) !== (assigneeId ?? null)) {
    throw new Error('Linear issue assignee update did not complete.');
  }
}

function validIssue(value: LinearIssue | null | undefined, expectedId: string): LinearIssue | null {
  if (!value || value.id !== expectedId || !value.identifier) return null;
  const url = new URL(value.url);
  if (url.protocol !== 'https:' || url.hostname !== 'linear.app' || !/^\/[a-z0-9-]+\/issue\/[A-Z]+-\d+(?:\/|$)/i.test(url.pathname)) throw new Error('Linear returned an invalid issue URL.');
  return value;
}

async function findIssue(id: string, token: string, request: typeof fetch): Promise<LinearIssue | null> {
  try {
    const data: { issue: LinearIssue | null } = await linearRequest(
      'query FeedbackIssue($id: String!) { issue(id: $id) { id identifier url } }', { id }, token, request,
    );
    return validIssue(data.issue, id);
  } catch (error) {
    if (error instanceof LinearNotFoundError) return null;
    throw error;
  }
}

export async function createOrFindLinearIssue(report: LinearReport, appBaseUrl: string, token: string, request: typeof fetch = fetch, loadFiles: () => Promise<LinearUploadedFile[]> = async () => []): Promise<LinearIssue> {
  if (!uuid.test(report.linearTeamId)) throw new Error('Invalid Linear team.');
  const id = linearIssueId(report.id);
  const found = await findIssue(id, token, request);
  if (found) return found;
  const files = await loadFiles();
  const assigneeId = await linearAssigneeId(report.linearAssigneeEmail, token, request);
  const input = {
    id, teamId: report.linearTeamId, title: `FB-${report.id.slice(-4).toUpperCase()} · ${report.title}`,
    description: linearDescription(report, appBaseUrl, files), priority: linearPriority(report.priority),
    ...(assigneeId ? { assigneeId } : {}),
  };
  try {
    const created: { issueCreate: { success: boolean; issue: LinearIssue | null } } = await linearRequest(
      'mutation CreateFeedbackIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }',
      { input }, token, request,
    );
    if (created.issueCreate?.success) {
      const issue = validIssue(created.issueCreate.issue, id);
      if (issue) return issue;
    }
  } catch {
    // A network failure may occur after Linear commits the issue. The fixed ID
    // makes this lookup safe on every retry, including concurrent deliveries.
  }
  const recovered = await findIssue(id, token, request);
  if (recovered) return recovered;
  throw new Error('Linear issue creation did not complete.');
}
