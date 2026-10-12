import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';
import { parseHarvestViewer, type HarvestViewer } from './harvest-membership';
import { isLocalFeedbackPreview } from './amplify';

/** AppSync validates the HARVEST access token before forwarding it to /api/me. */
export async function fetchHarvestViewer(providedAccessToken?: string): Promise<HarvestViewer> {
  if (isLocalFeedbackPreview()) {
    if (!providedAccessToken) throw new Error('Open Feedback from your HARVEST workspace.');
    const response = await fetch('/api/me', { headers: { Authorization: `Bearer ${providedAccessToken}` }, cache: 'no-store' });
    if (!response.ok) throw new Error('Could not verify your local HARVEST account.');
    return parseHarvestViewer(await response.json());
  }
  const endpoint = Amplify.getConfig().API?.GraphQL?.endpoint;
  const accessToken = providedAccessToken ?? (await fetchAuthSession()).tokens?.accessToken?.toString();
  if (!endpoint || !accessToken || new URL(endpoint).protocol !== 'https:') {
    throw new Error('HARVEST sign-in is not configured. Contact an administrator.');
  }
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: accessToken },
      body: JSON.stringify({ query: 'query HarvestViewer { harvestViewer }' }),
    });
  } catch {
    throw new Error('Could not verify your HARVEST account. Try again.');
  }
  if (!response.ok) throw new Error('Could not verify your HARVEST account. Try again.');
  const body = await response.json() as { data?: { harvestViewer?: unknown }; errors?: unknown[] };
  if (body.errors?.length || body.data?.harvestViewer == null) {
    throw new Error('Could not verify your HARVEST account. Try again.');
  }
  const value = typeof body.data.harvestViewer === 'string'
    ? JSON.parse(body.data.harvestViewer) as unknown
    : body.data.harvestViewer;
  return parseHarvestViewer(value);
}
