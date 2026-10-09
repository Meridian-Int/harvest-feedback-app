import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { requireAmplify } from './amplify';
import { isAdmin, requireUser } from './auth';
import type { SentryIssue } from './types';

const client = generateClient<Schema>();

export interface SentryIssuesResult {
  configured: boolean;
  issues: SentryIssue[];
}

export async function getSentryIssues(): Promise<SentryIssuesResult> {
  requireAmplify();
  if (!isAdmin(requireUser())) throw new Error('Admin access required.');
  const response = await client.queries.sentryIssues();
  if (response.errors?.length) throw new Error(response.errors[0].message);
  if (!response.data) throw new Error('Could not load Sentry issues.');
  return {
    configured: response.data.configured,
    issues: response.data.issues.filter(issue => issue != null).map(issue => ({
      id: issue.id,
      title: issue.title,
      culprit: issue.culprit,
      project: issue.project,
      level: issue.level,
      count: issue.count,
      userCount: issue.userCount,
      lastSeen: issue.lastSeen,
      permalink: issue.permalink,
      trend: issue.trend.filter(value => value != null),
    })),
  };
}
