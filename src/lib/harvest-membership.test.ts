import { describe, expect, it } from 'vitest';
import { parseHarvestViewer } from './harvest-membership';

const viewer = {
  person: { id: 'person-1', email: 'a@example.com', name: 'A' },
  memberships: [
    { orgId: 'org-1', orgKind: 'partner', orgName: 'Partner A', role: 'user', permissions: ['tools.add'] },
    { orgId: 'org-2', orgKind: 'operator', orgName: 'Meridian', role: 'admin' },
  ],
};

describe('HARVEST membership response', () => {
  it('keeps every active organization and its kind from the HARVEST response', () => {
    expect(parseHarvestViewer(viewer)).toEqual({
      person: viewer.person,
      memberships: [
        { orgId: 'org-1', orgKind: 'partner', orgName: 'Partner A', role: 'user' },
        { orgId: 'org-2', orgKind: 'operator', orgName: 'Meridian', role: 'admin' },
      ],
    });
  });

  it('denies accounts without a resolved HARVEST person or membership', () => {
    expect(() => parseHarvestViewer({ person: null, memberships: [] })).toThrow('Could not verify');
    expect(() => parseHarvestViewer({ person: viewer.person, memberships: [] })).toThrow('no active organization');
  });

  it('denies unknown or incomplete organization roles', () => {
    expect(() => parseHarvestViewer({ ...viewer, memberships: [{ ...viewer.memberships[0], orgKind: 'unknown' }] })).toThrow('Could not verify your HARVEST membership');
    expect(() => parseHarvestViewer({ ...viewer, memberships: [{ ...viewer.memberships[0], orgKind: ['partner'] }] })).toThrow('Could not verify your HARVEST membership');
    expect(() => parseHarvestViewer({ ...viewer, memberships: [{ ...viewer.memberships[0], role: 'superuser' }] })).toThrow('Could not verify your HARVEST membership');
  });
});
