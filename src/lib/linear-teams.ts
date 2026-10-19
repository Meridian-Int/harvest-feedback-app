import { isHarvestSharedSessionMode } from './amplify';
import { sharedRequest } from './shared-feedback-api';
import type { LinearTeamsResult } from './types';

export async function getLinearTeams(): Promise<LinearTeamsResult> {
  if (!isHarvestSharedSessionMode()) return { configured: false, teams: [] };
  const data = await sharedRequest<{ linearTeams?: LinearTeamsResult }>(
    'query FeedbackLinearTeams { linearTeams { configured teams { id name key } } }', {},
  );
  if (!data.linearTeams || !Array.isArray(data.linearTeams.teams)) throw new Error('Could not load Linear teams.');
  return data.linearTeams;
}
