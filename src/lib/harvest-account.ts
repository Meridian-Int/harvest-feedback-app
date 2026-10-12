import type { HarvestViewer } from './harvest-membership';
import type { AuthUser, Persona } from './types';

function persona(kind: 'company' | 'partner' | 'operator'): Persona {
  return kind === 'company' ? 'Company' : kind === 'partner' ? 'Partner' : 'Operator';
}

/** Make a client choose when several live organizations could own a report. */
export function harvestAccount(viewer: HarvestViewer, sub: string, groups: string[], selectedId?: string): AuthUser {
  const selected = viewer.memberships.find(item => item.orgId === selectedId)
    ?? (viewer.memberships.length === 1 ? viewer.memberships[0] : undefined);
  const fallback = selected ?? viewer.memberships[0];
  return {
    id: sub,
    email: viewer.person.email,
    name: viewer.person.name ?? viewer.person.email,
    persona: persona(fallback.orgKind),
    company: selected?.orgName ?? '',
    groups,
    harvest: {
      personId: viewer.person.id,
      memberships: viewer.memberships,
      ...(selected ? { selectedOrganizationId: selected.orgId } : {}),
      organizationRequired: !selected,
    },
  };
}
