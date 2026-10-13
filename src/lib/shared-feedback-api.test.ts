import { beforeEach, expect, it, vi } from 'vitest';
import { Amplify } from 'aws-amplify';
import { getUsableHarvestTokens } from './harvest-shared-session';
import { getSharedFeedback, listSharedFeedback, submitSharedFeedback, updateSharedFeedback } from './shared-feedback-api';

vi.mock('aws-amplify', () => ({ Amplify: { getConfig: vi.fn() } }));
vi.mock('./harvest-shared-session', () => ({ getUsableHarvestTokens: vi.fn() }));

const endpoint = 'https://feedback.example.com/graphql';
const report = { id: 'report-1', title: 'Broken button', description: 'Broken button', productArea: 'Data room',
  priority: 'BUG', severity: 'MEDIUM', reporterName: 'Sahil', reporterEmail: 'sahil@example.com',
  persona: 'Company', company: 'Roku', status: 'NEW', owner: 'sub-1', createdAt: '2026-10-12T00:00:00Z', updatedAt: '2026-10-12T00:00:00Z' };

function answer(data: unknown) {
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  vi.mocked(Amplify.getConfig).mockReturnValue({ API: { GraphQL: { endpoint, defaultAuthMode: 'userPool' } } } as never);
  vi.mocked(getUsableHarvestTokens).mockResolvedValue({ accessToken: 'access', idToken: 'id', refreshToken: 'refresh', expiresAt: Date.now() + 60_000 });
  vi.stubGlobal('fetch', vi.fn());
});

it('reads all authorized report pages with the HARVEST access token', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(answer({ listFeedbacks: { items: [report], nextToken: 'page-2' } }))
    .mockResolvedValueOnce(answer({ listFeedbacks: { items: [], nextToken: null } }));
  expect(await listSharedFeedback()).toEqual([report]);
  expect(fetch).toHaveBeenCalledTimes(2);
  const [, init] = vi.mocked(fetch).mock.calls[0];
  expect(init?.headers).toMatchObject({ Authorization: 'access' });
  expect(JSON.parse(String(init?.body)).variables.nextToken).toBeNull();
});

it('uses HARVEST tokens for report detail, updates, and submission', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(answer({ getFeedback: report }))
    .mockResolvedValueOnce(answer({ updateFeedback: { ...report, status: 'ASSIGNED' } }))
    .mockResolvedValueOnce(answer({ submitFeedback: report }));
  expect((await getSharedFeedback('report-1'))?.id).toBe('report-1');
  expect((await updateSharedFeedback({ id: 'report-1', status: 'ASSIGNED' })).status).toBe('ASSIGNED');
  await submitSharedFeedback({ description: 'Broken button', productArea: 'Data room', priority: 'BUG', severity: 'MEDIUM', organizationId: 'company-1' });
  const [, submitInit] = vi.mocked(fetch).mock.calls[2];
  expect(submitInit?.headers).toMatchObject({ Authorization: 'access' });
  expect(JSON.parse(String(submitInit?.body)).variables.organizationId).toBe('company-1');
});

it('surfaces AppSync authorization errors instead of pretending a save succeeded', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: 'Not Authorized' }] }), { status: 200 }));
  await expect(updateSharedFeedback({ id: 'report-1', status: 'CLOSED' })).rejects.toThrow('Not Authorized');
});
