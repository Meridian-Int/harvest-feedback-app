import * as Sentry from '@sentry/react';

interface SentryEnvironment {
  VITE_SENTRY_DSN?: string;
  VITE_SENTRY_ENVIRONMENT?: string;
  PROD: boolean;
}

/** Feedback is a separate build, even when HARVEST proxies it on the same domain. */
export function initFeedbackSentry(env: SentryEnvironment, hostname: string): boolean {
  const dsn = env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return false;

  const environment = env.VITE_SENTRY_ENVIRONMENT?.trim()
    || (hostname.endsWith('.amplifyapp.com') ? hostname.split('.')[0] : env.PROD ? 'main' : 'development');
  Sentry.init({
    dsn,
    environment,
    initialScope: { tags: { app: 'feedback' } },
  });
  return true;
}
