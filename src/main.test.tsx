import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-dom/client', () => ({ default: { createRoot: vi.fn(() => ({ render: vi.fn() })) } }));
vi.mock('./app/App', () => ({ App: () => null }));
vi.mock('./lib/sentry', () => ({ initFeedbackSentry: vi.fn() }));
vi.mock('./styles/global.css', () => ({}));

type AnalyticsWindow = Window & {
  dataLayer?: IArguments[];
  gtag?: (...args: unknown[]) => void;
};
const analytics = window as AnalyticsWindow;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_SENTRY_DSN', '');
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST1234');
});

afterEach(() => {
  delete analytics.dataLayer;
  delete analytics.gtag;
  document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').forEach(script => script.remove());
  vi.unstubAllEnvs();
});

describe('Feedback GA4 bootstrap', () => {
  it('queues commands in the Arguments format expected by the Google tag', async () => {
    await import('./main');

    const commands = analytics.dataLayer!;
    expect(commands).toHaveLength(2);
    for (const command of commands) {
      expect(Object.prototype.toString.call(command)).toBe('[object Arguments]');
      expect(Array.isArray(command)).toBe(false);
    }
    expect(Array.from(commands[0])).toEqual(['js', expect.any(Date)]);
    expect(Array.from(commands[1])).toEqual(['config', 'G-TEST1234', { send_page_view: false }]);

    analytics.gtag!('event', 'page_view', { page_path: '/feedback/new' });
    expect(Object.prototype.toString.call(commands[2])).toBe('[object Arguments]');
    expect(Array.from(commands[2])).toEqual(['event', 'page_view', { page_path: '/feedback/new' }]);
    expect(document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]')).toHaveLength(1);
  });

  it('preserves an existing data layer and trims the configured measurement ID', async () => {
    const existing: IArguments[] = [];
    analytics.dataLayer = existing;
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', ' G-TEST1234 ');
    await import('./main');

    expect(analytics.dataLayer).toBe(existing);
    expect(document.querySelector<HTMLScriptElement>('script[src*="gtag/js"]')?.src)
      .toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST1234');
  });

  it.each(['', '  '])('does not load Google or install a queue without an ID (%s)', async value => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', value);
    await import('./main');

    expect(analytics.gtag).toBeUndefined();
    expect(analytics.dataLayer).toBeUndefined();
    expect(document.querySelector('script[src*="gtag/js"]')).toBeNull();
  });
});
