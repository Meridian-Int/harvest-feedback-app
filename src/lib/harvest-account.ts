import type { HarvestViewer } from './harvest-membership';
import type { AuthUser, Persona } from './types';

export const FEEDBACK_ADMIN_GROUP = 'feedback-admins';

function persona(kind: 'company' | 'partner' | 'operator'): Persona {
  return kind === 'company' ? 'Company' : kind === 'partner' ? 'Partner' : 'Operator';
}

/** Make a client choose when several live organizations could own a report. */
export function harvestAccount(viewer: HarvestViewer, sub: string, groups: string[], selectedId?: string): AuthUser {
  const admin = groups.includes(FEEDBACK_ADMIN_GROUP) && viewer.memberships.some(item => item.orgKind === 'operator');
  const memberships = admin ? viewer.memberships.filter(item => item.orgKind === 'operator') : viewer.memberships;
  const selected = memberships.find(item => item.orgId === selectedId)
    ?? (memberships.length === 1 ? memberships[0] : undefined);
  const fallback = selected ?? memberships[0];
  return {
    id: sub,
    email: viewer.person.email,
    name: viewer.person.name ?? viewer.person.email,
    persona: persona(fallback.orgKind),
    company: selected?.orgName ?? '',
    groups,
    harvest: {
      personId: viewer.person.id,
      memberships,
      ...(selected ? { selectedOrganizationId: selected.orgId } : {}),
      organizationRequired: !selected,
    },
  };
}
