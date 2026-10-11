import { expect, it } from 'vitest';
import { harvestAccount } from './harvest-account';
import type { HarvestViewer } from './harvest-membership';

const viewer: HarvestViewer = {
  person: { id: 'person-1', email: 'sahil@example.com', name: 'Sahil' },
  memberships: [
    { orgId: 'company-1', orgKind: 'company', orgName: 'Company One', role: 'user' },
    { orgId: 'partner-2', orgKind: 'partner', orgName: 'Partner Two', role: 'user' },
  ],
};

it('requires an explicit organization when a person belongs to several', () => {
  const user = harvestAccount(viewer, 'sub-1', []);
  expect(user.harvest?.organizationRequired).toBe(true);
  expect(user.harvest?.selectedOrganizationId).toBeUndefined();
  expect(user.company).toBe('');
});

it('uses only a live selected organization and ignores a removed selection', () => {
  expect(harvestAccount(viewer, 'sub-1', [], 'partner-2')).toMatchObject({ persona: 'Partner', company: 'Partner Two' });
  expect(harvestAccount(viewer, 'sub-1', [], 'removed-org').harvest?.organizationRequired).toBe(true);
});

it('does not treat an ordinary operator as a Feedback admin', () => {
  const operator: HarvestViewer = { ...viewer, memberships: [{ orgId: 'operator-1', orgKind: 'operator', orgName: 'Meridian', role: 'admin' }] };
  expect(harvestAccount(operator, 'sub-1', []).groups).toEqual([]);
  expect(harvestAccount(operator, 'sub-1', ['feedback-admins']).harvest?.selectedOrganizationId).toBe('operator-1');
});
