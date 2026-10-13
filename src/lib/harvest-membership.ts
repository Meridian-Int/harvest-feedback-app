/** The identity and live memberships returned by HARVEST's GET /api/me. */
export interface HarvestMembership {
  orgId: string;
  orgKind: 'company' | 'partner' | 'operator';
  orgName: string;
  role: 'owner' | 'admin' | 'user';
}

export interface HarvestViewer {
  feedbackAdmin?: boolean;
  person: { id: string; email: string; name: string | null };
  memberships: HarvestMembership[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function orgKind(value: unknown): value is HarvestMembership['orgKind'] {
  return value === 'company' || value === 'partner' || value === 'operator';
}

function role(value: unknown): value is HarvestMembership['role'] {
  return value === 'owner' || value === 'admin' || value === 'user';
}

/** Reject incomplete responses so an auth integration never guesses a role. */
export function parseHarvestViewer(value: unknown): HarvestViewer {
  if (!record(value) || !record(value.person) || !Array.isArray(value.memberships)) {
    throw new Error('Could not verify your HARVEST account. Try again.');
  }
  const { person } = value;
  if (!nonempty(person.id) || !nonempty(person.email) ||
      !(person.name === null || nonempty(person.name))) {
    throw new Error('Your HARVEST account profile is incomplete. Contact an administrator.');
  }
  const memberships = value.memberships.map((item): HarvestMembership => {
    if (!record(item) || !nonempty(item.orgId) || !nonempty(item.orgName) ||
        !orgKind(item.orgKind) || !role(item.role)) {
      throw new Error('Could not verify your HARVEST membership. Try again.');
    }
    return {
      orgId: item.orgId,
      orgKind: item.orgKind,
      orgName: item.orgName,
      role: item.role,
    };
  });
  if (memberships.length === 0) {
    throw new Error('Your HARVEST account has no active organization. Contact an administrator.');
  }
  return {
    person: { id: person.id, email: person.email, name: person.name },
    ...(value.feedbackAdmin === true ? { feedbackAdmin: true } : {}),
    memberships,
  };
}
