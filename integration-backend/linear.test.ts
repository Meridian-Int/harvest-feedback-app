import { expect, it, vi } from 'vitest';
import { createOrFindLinearIssue, linearDescription, linearIssueId, linearPriority, listLinearTeams, uploadLinearFile, type LinearReport } from './linear';

const teamId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const report: LinearReport = { id: '12345678-1234-4123-8123-12345678e247', title: 'Upload stalls at 90%', description: 'Upload stalls\nPlease investigate.', productArea: 'Data room', priority: 'BUG', linearTeamId: teamId, linearAssigneeEmail: 'Owner@withmeridian.ai' };
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });

it('formats a structured report without inventing steps, exposing email, or using an attachment URL', () => {
  const description = linearDescription(report, 'https://staging.harvestbymeridian.ai/feedback');
  expect(description).toContain('## Context');
  expect(description).toContain('## Reported behavior\n> Upload stalls\n> Please investigate.');
  expect(description).toContain('/feedback/admin/reviews?report=12345678-1234-4123-8123-12345678e247');
  expect(description).not.toContain('Owner@withmeridian.ai');
  expect(description).not.toContain('Definition of done');
  expect(linearPriority('BLOCKER')).toBe(1);
  expect(linearPriority('BUG')).toBe(2);
  expect(linearPriority('IMPROVEMENT')).toBe(3);
  expect(linearIssueId(report.id)).toBe(linearIssueId(report.id));
  expect(linearIssueId(report.id)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
});

it('loads every team page and sorts team choices', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce(response({ data: { teams: { nodes: [{ id: teamId, name: 'Engineering', key: 'ENG' }], pageInfo: { hasNextPage: true, endCursor: 'next' } } } }))
    .mockResolvedValueOnce(response({ data: { teams: { nodes: [{ id: userId, name: 'Data', key: 'DATA' }], pageInfo: { hasNextPage: false, endCursor: null } } } }));
  expect(await listLinearTeams('token', request as typeof fetch)).toEqual([{ id: userId, name: 'Data', key: 'DATA' }, { id: teamId, name: 'Engineering', key: 'ENG' }]);
  expect(JSON.parse(request.mock.calls[1][1].body).variables.after).toBe('next');
});

it('creates one issue in the chosen team and assigns only a matching active Linear user', async () => {
  const id = linearIssueId(report.id);
  const issue = { id, identifier: 'ENG-123', url: 'https://linear.app/withmeridian/issue/ENG-123/upload-stalls' };
  const request = vi.fn()
    .mockResolvedValueOnce(response({ data: { issue: null } }))
    .mockResolvedValueOnce(response({ data: { users: { nodes: [{ id: userId, email: 'owner@withmeridian.ai', active: true, isAssignable: true }], pageInfo: { hasNextPage: false, endCursor: null } } } }))
    .mockResolvedValueOnce(response({ data: { issueCreate: { success: true, issue } } }));
  expect(await createOrFindLinearIssue(report, 'https://staging.harvestbymeridian.ai/feedback', 'token', request as typeof fetch)).toEqual(issue);
  const input = JSON.parse(request.mock.calls[2][1].body).variables.input;
  expect(input).toMatchObject({ id, teamId, assigneeId: userId, priority: 2, title: 'FB-E247 · Upload stalls at 90%' });
  expect(input.description).not.toContain('Owner@withmeridian.ai');
  expect(request.mock.calls.every(call => call[0] === 'https://api.linear.app/graphql')).toBe(true);
});

it('finds a previously created deterministic issue before attempting another create', async () => {
  const issue = { id: linearIssueId(report.id), identifier: 'ENG-123', url: 'https://linear.app/withmeridian/issue/ENG-123/upload-stalls' };
  const request = vi.fn().mockResolvedValue(response({ data: { issue } }));
  expect(await createOrFindLinearIssue(report, 'https://staging.harvestbymeridian.ai/feedback', 'token', request as typeof fetch)).toEqual(issue);
  expect(request).toHaveBeenCalledOnce();
});

it('uploads a file to Linear private storage using its signed headers', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce(response({ data: { fileUpload: { success: true, uploadFile: { uploadUrl: 'https://storage.googleapis.com/signed', assetUrl: 'https://uploads.linear.app/asset', headers: [{ key: 'x-upload-token', value: 'signed' }] } } } }))
    .mockResolvedValueOnce(new Response('', { status: 200 }));
  expect(await uploadLinearFile({ name: 'screen.webm', type: 'video/webm', bytes: new Uint8Array([1, 2, 3]) }, 'token', request as typeof fetch)).toEqual({ name: 'screen.webm', url: 'https://uploads.linear.app/asset' });
  expect(JSON.parse(request.mock.calls[0][1].body).variables).toMatchObject({ filename: 'screen.webm', contentType: 'video/webm', size: 3 });
  expect(request.mock.calls[1][0]).toBe('https://storage.googleapis.com/signed');
  expect(request.mock.calls[1][1].headers.get('x-upload-token')).toBe('signed');
  expect(request.mock.calls[1][1].method).toBe('PUT');
});

it('fails a rejected Linear file PUT before an issue can be created', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce(response({ data: { fileUpload: { success: true, uploadFile: { uploadUrl: 'https://storage.googleapis.com/signed', assetUrl: 'https://uploads.linear.app/asset', headers: [] } } } }))
    .mockResolvedValueOnce(new Response('', { status: 403 }));
  await expect(uploadLinearFile({ name: 'screen.webm', type: 'video/webm', bytes: new Uint8Array([1]) }, 'token', request as typeof fetch)).rejects.toThrow('HTTP 403');
});

it('includes uploaded files in the fixed issue template before creating the issue', async () => {
  const issue = { id: linearIssueId(report.id), identifier: 'ENG-123', url: 'https://linear.app/withmeridian/issue/ENG-123/upload-stalls' };
  const request = vi.fn()
    .mockResolvedValueOnce(response({ data: { issue: null } }))
    .mockResolvedValueOnce(response({ data: { users: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } }))
    .mockResolvedValueOnce(response({ data: { issueCreate: { success: true, issue } } }));
  const loadFiles = vi.fn().mockResolvedValue([{ name: 'screen.webm', url: 'https://uploads.linear.app/asset' }]);
  await createOrFindLinearIssue(report, 'https://staging.harvestbymeridian.ai/feedback', 'token', request as typeof fetch, loadFiles);
  expect(loadFiles).toHaveBeenCalledOnce();
  expect(JSON.parse(request.mock.calls[2][1].body).variables.input.description).toContain('## Attachments\n- [screen.webm](https://uploads.linear.app/asset)');
});

it('skips another file transfer when the deterministic issue already exists', async () => {
  const issue = { id: linearIssueId(report.id), identifier: 'ENG-123', url: 'https://linear.app/withmeridian/issue/ENG-123/upload-stalls' };
  const request = vi.fn().mockResolvedValue(response({ data: { issue } }));
  const loadFiles = vi.fn();
  await createOrFindLinearIssue(report, 'https://staging.harvestbymeridian.ai/feedback', 'token', request as typeof fetch, loadFiles);
  expect(loadFiles).not.toHaveBeenCalled();
});

it('recovers a committed issue after the create response fails', async () => {
  const issue = { id: linearIssueId(report.id), identifier: 'ENG-123', url: 'https://linear.app/withmeridian/issue/ENG-123/upload-stalls' };
  const request = vi.fn()
    .mockResolvedValueOnce(response({ data: { issue: null } }))
    .mockResolvedValueOnce(response({ data: { users: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } }))
    .mockRejectedValueOnce(new Error('Connection reset'))
    .mockResolvedValueOnce(response({ data: { issue } }));
  expect(await createOrFindLinearIssue(report, 'https://staging.harvestbymeridian.ai/feedback', 'token', request as typeof fetch)).toEqual(issue);
  expect(JSON.parse(request.mock.calls[2][1].body).variables.input).not.toHaveProperty('assigneeId');
});

it('leaves an active but ineligible matching Linear user unassigned', async () => {
  const id = linearIssueId(report.id);
  const issue = { id, identifier: 'ENG-124', url: 'https://linear.app/withmeridian/issue/ENG-124/upload-stalls' };
  const request = vi.fn()
    .mockResolvedValueOnce(response({ data: { issue: null } }))
    .mockResolvedValueOnce(response({ data: { users: { nodes: [{ id: userId, email: 'owner@withmeridian.ai', active: true, isAssignable: false }], pageInfo: { hasNextPage: false, endCursor: null } } } }))
    .mockResolvedValueOnce(response({ data: { issueCreate: { success: true, issue } } }));
  await createOrFindLinearIssue(report, 'https://staging.harvestbymeridian.ai/feedback', 'token', request as typeof fetch);
  expect(JSON.parse(request.mock.calls[2][1].body).variables.input).not.toHaveProperty('assigneeId');
});
