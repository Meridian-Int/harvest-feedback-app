import { expect, it } from 'vitest';
import { harvestAccount } from './harvest-account';
import { isAdmin } from './auth';
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

it('requires a Feedback admin assignment as well as a selected live operator membership', () => {
  const operator: HarvestViewer = { ...viewer, memberships: [{ orgId: 'operator-1', orgKind: 'operator', orgName: 'Meridian', role: 'admin' }] };
  const user = harvestAccount(operator, 'sub-1', ['feedback-admins']);
  expect(user.harvest?.selectedOrganizationId).toBe('operator-1');
  expect(isAdmin(user)).toBe(true);
  expect(isAdmin(harvestAccount(operator, 'sub-1', []))).toBe(false);
});

it('uses the selected HARVEST workspace when a feedback admin also belongs to a company', () => {
  const mixed: HarvestViewer = { ...viewer, memberships: [
    { orgId: 'operator-1', orgKind: 'operator', orgName: 'Meridian', role: 'admin' },
    viewer.memberships[0],
  ] };
  const companyUser = harvestAccount(mixed, 'sub-1', ['feedback-admins'], 'company-1');
  expect(companyUser.persona).toBe('Company');
  expect(isAdmin(companyUser)).toBe(false);
  const adminUser = harvestAccount(mixed, 'sub-1', ['feedback-admins'], 'operator-1');
  expect(adminUser.persona).toBe('Operator');
  expect(isAdmin(adminUser)).toBe(true);
});
