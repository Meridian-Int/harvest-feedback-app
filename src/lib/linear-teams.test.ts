import { beforeEach, expect, it, vi } from 'vitest';
import { getLinearTeams } from './linear-teams';
import { isHarvestSharedSessionMode } from './amplify';
import { sharedRequest } from './shared-feedback-api';

vi.mock('./amplify', () => ({ isHarvestSharedSessionMode: vi.fn() }));
vi.mock('./shared-feedback-api', () => ({ sharedRequest: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('does not call the integrated API in standalone mode', async () => {
  vi.mocked(isHarvestSharedSessionMode).mockReturnValue(false);
  await expect(getLinearTeams()).resolves.toEqual({ configured: false, teams: [] });
  expect(sharedRequest).not.toHaveBeenCalled();
});

it('loads the guarded team choices in integrated mode and rejects an incomplete response', async () => {
  vi.mocked(isHarvestSharedSessionMode).mockReturnValue(true);
  const result = { configured: true, teams: [{ id: 'team-id', name: 'Data & Engineering', key: 'ENG' }] };
  vi.mocked(sharedRequest).mockResolvedValueOnce({ linearTeams: result }).mockResolvedValueOnce({});
  await expect(getLinearTeams()).resolves.toEqual(result);
  await expect(getLinearTeams()).rejects.toThrow('Could not load Linear teams.');
});
