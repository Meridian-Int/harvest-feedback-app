import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { App } from './app/App';
import './styles/global.css';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();
if (sentryDsn) {
  const host = window.location.hostname;
  const environment = host.endsWith('.amplifyapp.com') ? host.split('.')[0] : import.meta.env.PROD ? 'main' : 'development';
  Sentry.init({ dsn: sentryDsn, environment });
}

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
if (measurementId) {
  const analytics = window as Window & { dataLayer?: unknown[][]; gtag?: (...args: unknown[]) => void };
  analytics.dataLayer ??= [];
  analytics.gtag = (...args: unknown[]) => { analytics.dataLayer!.push(args); };
  analytics.gtag('js', new Date());
  analytics.gtag('config', measurementId, { send_page_view: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
