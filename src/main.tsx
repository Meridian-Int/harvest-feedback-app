import './styles/layers.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initFeedbackSentry } from './lib/sentry';
import { App } from './app/App';
import './styles/global.css';

initFeedbackSentry(import.meta.env, window.location.hostname);

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
if (measurementId) {
  const analytics = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  analytics.dataLayer ??= [];
  // Google's tag consumes Arguments objects, rather than arrays of parameters.
  analytics.gtag = function () { analytics.dataLayer!.push(arguments); };
  analytics.gtag('js', new Date());
  analytics.gtag('config', measurementId, { send_page_view: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
