import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { isHarvestSharedSessionMode, requireAmplify } from './amplify';
import { isAdmin, requireUser } from './auth';
import type { SentryIssue } from './types';
import { sharedRequest } from './shared-feedback-api';

const client = generateClient<Schema>();

export interface SentryIssuesResult {
  configured: boolean;
  issues: SentryIssue[];
}

export interface TrafficInsightsResult {
  configured: boolean;
  users: number;
  sessions: number;
  pageViews: number;
  days: { day: string; users: number }[];
  pages: { name: string; views: number }[];
}

export async function getTrafficInsights(): Promise<TrafficInsightsResult> {
  requireAmplify();
  if (!isAdmin(requireUser())) throw new Error('Admin access required.');
  if (!isHarvestSharedSessionMode()) return { configured: false, users: 0, sessions: 0, pageViews: 0, days: [], pages: [] };
  const response = await sharedRequest<{ trafficInsights?: TrafficInsightsResult }>(
    `query TrafficInsights { trafficInsights { configured users sessions pageViews days { day users } pages { name views } } }`, {},
  );
  if (!response.trafficInsights) throw new Error('Could not load GA4 traffic.');
  return response.trafficInsights;
}

export async function getSentryIssues(): Promise<SentryIssuesResult> {
  requireAmplify();
  if (!isAdmin(requireUser())) throw new Error('Admin access required.');
  const response = isHarvestSharedSessionMode()
    ? { data: (await sharedRequest<{ sentryIssues?: SentryIssuesResult }>(
      `query SentryIssues { sentryIssues {
        configured issues { id title culprit project level count userCount lastSeen permalink trend }
      } }`, {},
    )).sentryIssues }
    : await client.queries.sentryIssues();
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
