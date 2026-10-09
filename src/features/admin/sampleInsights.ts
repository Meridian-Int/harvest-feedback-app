import type { SentryIssue } from '../../lib/types';

export interface SampleIssue extends SentryIssue {
  seen: string;
}

// Presentation values from the approved prototype. Never submit these to AWS.
export const SAMPLE_ISSUES: SampleIssue[] = [
  {
    id: 'ERR-101', title: "Cannot read properties of undefined (reading 'amountMinor')",
    culprit: 'PaymentsDueList.tsx', project: 'harvest-ui', level: 'Error',
    count: 176, userCount: 42, seen: '12 min ago', lastSeen: '', permalink: '',
    trend: [4, 6, 5, 9, 14, 12, 18, 22, 16, 20, 26, 24],
  },
  {
    id: 'ERR-102', title: 'Lambda timed out after 29 seconds',
    culprit: 'GET /api/companies/:slug/data-room', project: 'harvest-api', level: 'Error',
    count: 97, userCount: 23, seen: '28 min ago', lastSeen: '', permalink: '',
    trend: [10, 8, 12, 9, 7, 11, 8, 6, 9, 7, 5, 6],
  },
  {
    id: 'ERR-103', title: 'ChunkLoadError: Loading chunk 412 failed',
    culprit: 'app/App.tsx', project: 'harvest-ui', level: 'Warning',
    count: 34, userCount: 12, seen: '1 hour ago', lastSeen: '', permalink: '',
    trend: [2, 2, 3, 2, 4, 3, 2, 5, 3, 2, 3, 2],
  },
  {
    id: 'ERR-104', title: 'Upload aborted: file exceeds the size limit',
    culprit: 'NewReport upload', project: 'feedback-app', level: 'Warning',
    count: 49, userCount: 18, seen: '2 hours ago', lastSeen: '', permalink: '',
    trend: [1, 3, 2, 4, 2, 3, 5, 4, 6, 5, 7, 8],
  },
];

export const SAMPLE_TRAFFIC = {
  users: 287,
  sessions: 364,
  reportsSent: 24,
  days: [
    { day: 'Fri', users: 38 }, { day: 'Sat', users: 12 },
    { day: 'Sun', users: 9 }, { day: 'Mon', users: 54 },
    { day: 'Tue', users: 61 }, { day: 'Wed', users: 47 },
    { day: 'Thu', users: 66 },
  ],
  pages: [
    { name: 'Data room', views: 428 }, { name: 'Payments', views: 312 },
    { name: 'Onboarding', views: 184 }, { name: 'Feedback', views: 96 },
  ],
} as const;
