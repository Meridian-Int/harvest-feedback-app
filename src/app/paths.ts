/** In shared-session mode every Feedback page stays under HARVEST's /feedback path. */
const shared = import.meta.env.VITE_HARVEST_AUTH_MODE === 'shared';

export const appPaths = {
  newFeedback: '/feedback/new',
  myReports: '/feedback/mine',
  adminReviews: shared ? '/feedback/admin/reviews' : '/admin/reviews',
  adminInsights: shared ? '/feedback/admin/insights' : '/admin/insights',
  organization: shared ? '/feedback/account/organization' : '/account/organization',
  signIn: shared ? '/feedback/session-required' : '/sign-in',
} as const;
