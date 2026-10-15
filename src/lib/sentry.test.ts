import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';
import { initFeedbackSentry } from './sentry';

vi.mock('@sentry/react', () => ({ init: vi.fn() }));

const dsn = 'https://public@example.ingest.sentry.io/123';

beforeEach(() => vi.clearAllMocks());

describe('Feedback Sentry initialization', () => {
  it('labels a production-mode build prestaging when explicitly configured', () => {
    expect(initFeedbackSentry({
      PROD: true,
      VITE_SENTRY_DSN: ` ${dsn} `,
      VITE_SENTRY_ENVIRONMENT: ' prestaging ',
    }, 'harvest.example.com')).toBe(true);
    expect(Sentry.init).toHaveBeenCalledExactlyOnceWith({
      dsn,
      environment: 'prestaging',
      initialScope: { tags: { app: 'feedback' } },
    });
  });

  it('prefers the explicit environment over the hosting branch', () => {
    initFeedbackSentry({ PROD: true, VITE_SENTRY_DSN: dsn, VITE_SENTRY_ENVIRONMENT: 'prestaging' }, 'main.example.amplifyapp.com');
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ environment: 'prestaging' }));
  });

  it.each([undefined, '', '  '])('does not initialize without a DSN (%s)', value => {
    expect(initFeedbackSentry({ PROD: true, VITE_SENTRY_DSN: value }, 'harvest.example.com')).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it.each([
    ['dev.example.amplifyapp.com', true, 'dev'],
    ['harvest.example.com', true, 'main'],
    ['localhost', false, 'development'],
  ] as const)('preserves the fallback for %s', (hostname, production, environment) => {
    initFeedbackSentry({ PROD: production, VITE_SENTRY_DSN: dsn, VITE_SENTRY_ENVIRONMENT: ' ' }, hostname);
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ environment }));
  });
});
