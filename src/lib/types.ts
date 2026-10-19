/** Stable application contracts. No SDK or mock-storage types escape the lib layer. */
import type { HarvestMembership } from './harvest-membership';
export type Priority = 'BLOCKER' | 'BUG' | 'IMPROVEMENT';
export type Severity = 'CRITICAL' | 'MEDIUM' | 'LOW';
export type Status = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
export type Persona = 'Company' | 'Partner' | 'Operator';

export interface AuthUser {
  needsPasswordSetup?: boolean;
  needsPersonaSetup?: boolean;
  id: string;
  email: string;
  name: string;
  persona: Persona;
  company: string;
  groups: string[];
  harvest?: {
    personId: string;
    memberships: HarvestMembership[];
    selectedOrganizationId?: string;
    organizationRequired: boolean;
  };
}

export interface Attachment {
  attachmentKey: string;
  attachmentName: string;
  attachmentType: string;
  attachmentSize: number;
}

/** Legacy single-file fields mirror the first entry of `attachments`. */
export interface Feedback extends Partial<Attachment> {
  attachments?: Attachment[];
  id: string;
  title: string;
  description: string;
  productArea: string;
  customArea?: string;
  priority: Priority;
  severity: Severity;
  reporterName: string;
  reporterEmail: string;
  persona: Persona;
  company: string;
  status: Status;
  assignee?: string;
  updateRequestedAt?: string;
  adminActivityAt?: string;
  sentryIssueId?: string;
  linearTeamId?: string;
  linearIssueId?: string;
  linearIssueIdentifier?: string;
  linearIssueUrl?: string;
  linearSyncStatus?: 'PENDING' | 'FAILED' | 'LINKED';
  owner: string;
  createdAt: string;
  updatedAt: string;
}

/** Reporter identity, title, ownership and timestamps are supplied by the API. */
export interface CreateFeedbackInput extends Partial<Attachment> {
  attachments?: Attachment[];
  description: string;
  productArea: string;
  customArea?: string;
  priority: Priority;
  severity: Severity;
  sentryIssueId?: string;
}

export interface AdminUpdateInput {
  status: Status;
  assignee?: string;
  linearTeamId?: string;
}

export interface LinearTeam { id: string; name: string; key: string }
export interface LinearTeamsResult { configured: boolean; teams: LinearTeam[] }

export interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  project: string;
  level: string;
  count: number;
  userCount: number;
  lastSeen: string;
  permalink: string;
  trend: number[];
}
