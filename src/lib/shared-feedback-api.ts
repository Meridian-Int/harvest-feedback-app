import { Amplify } from 'aws-amplify';
import { getUsableHarvestTokens } from './harvest-shared-session';
import type { Feedback } from './types';

const FIELDS = `id title description productArea customArea priority severity reporterName reporterEmail
  persona company status assignee attachmentKey attachmentName attachmentType attachmentSize
  updateRequestedAt adminActivityAt sentryIssueId owner createdAt updatedAt`;

type RawFeedback = Feedback & { customArea?: string | null; assignee?: string | null };
type FeedbackPage = { items?: RawFeedback[]; nextToken?: string | null };

export async function sharedRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  headers: Record<string, string> = {},
  request: typeof fetch = fetch,
  providedAccessToken?: string,
): Promise<T> {
  const endpoint = Amplify.getConfig().API?.GraphQL?.endpoint;
  if (!endpoint || new URL(endpoint).protocol !== 'https:') throw new Error('Feedback API is not configured.');
  const accessToken = providedAccessToken ?? (await getUsableHarvestTokens()).accessToken;
  let response: Response;
  try {
    response = await request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: accessToken, ...headers },
      body: JSON.stringify({ query, variables }),
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch { throw new Error('Could not reach Feedback. Try again.'); }
  if (!response.ok) throw new Error('Could not reach Feedback. Try again.');
  const body = await response.json() as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors[0].message);
  if (!body.data) throw new Error('Feedback returned an incomplete response. Try again.');
  return body.data;
}

export async function listSharedFeedback(): Promise<RawFeedback[]> {
  const results: RawFeedback[] = [];
  const seen = new Set<string>();
  let nextToken: string | null = null;
  do {
    const data: { listFeedbacks?: FeedbackPage } = await sharedRequest<{ listFeedbacks?: FeedbackPage }>(
      `query ListFeedback($limit: Int, $nextToken: String) {
        listFeedbacks(limit: $limit, nextToken: $nextToken) { items { ${FIELDS} } nextToken }
      }`, { limit: 100, nextToken },
    );
    const page: FeedbackPage | undefined = data.listFeedbacks;
    if (!page || !Array.isArray(page.items)) throw new Error('Could not load feedback reports. Try again.');
    results.push(...page.items);
    nextToken = page.nextToken ?? null;
    if (nextToken && seen.has(nextToken)) throw new Error('Could not load feedback reports. Try again.');
    if (nextToken) seen.add(nextToken);
  } while (nextToken);
  return results;
}

export async function getSharedFeedback(id: string): Promise<RawFeedback | null> {
  const data = await sharedRequest<{ getFeedback?: RawFeedback | null }>(
    `query GetFeedback($id: ID!) { getFeedback(id: $id) { ${FIELDS} } }`, { id },
  );
  return data.getFeedback ?? null;
}

export async function updateSharedFeedback(input: Record<string, unknown>): Promise<RawFeedback> {
  const data = await sharedRequest<{ updateFeedback?: RawFeedback | null }>(
    `mutation UpdateFeedback($input: UpdateFeedbackInput!) {
      updateFeedback(input: $input) { ${FIELDS} }
    }`, { input },
  );
  if (!data.updateFeedback) throw new Error('Report unavailable.');
  return data.updateFeedback;
}

export async function submitSharedFeedback(input: Record<string, unknown>): Promise<RawFeedback> {
  const { accessToken } = await getUsableHarvestTokens();
  const data = await sharedRequest<{ submitFeedback?: RawFeedback | null }>(
    `mutation SubmitFeedback(
      $description: String!, $productArea: String!, $customArea: String,
      $priority: Priority!, $severity: Severity!, $attachmentKey: String,
      $attachmentName: String, $attachmentType: String, $attachmentSize: Int,
      $sentryIssueId: String, $organizationId: String
    ) { submitFeedback(
      description: $description, productArea: $productArea, customArea: $customArea,
      priority: $priority, severity: $severity, attachmentKey: $attachmentKey,
      attachmentName: $attachmentName, attachmentType: $attachmentType,
      attachmentSize: $attachmentSize, sentryIssueId: $sentryIssueId,
      organizationId: $organizationId
    ) { ${FIELDS} } }`, input, {}, fetch, accessToken,
  );
  if (!data.submitFeedback) throw new Error('Could not create the report. Try again.');
  return data.submitFeedback;
}
