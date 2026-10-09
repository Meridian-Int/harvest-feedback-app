import { useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { IconSymbols } from '../components/icons';
import { AuthProvider, useAuth } from './AuthProvider';
import { ThemeProvider } from './ThemeProvider';
import { AppRoutes } from './routes';

export function Telemetry() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const previousPath = useRef<string | null>(null);
  useEffect(() => {
    if (import.meta.env.VITE_SENTRY_DSN) Sentry.setUser(user ? { id: user.id } : null);
  }, [user?.id]);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) return;
    const analytics = window as Window & { gtag?: (...args: unknown[]) => void };
    analytics.gtag?.('event', 'page_view', { page_path: pathname, page_location: `${window.location.origin}${pathname}` });
  }, [pathname]);
  return null;
}

export function App() {
  return <BrowserRouter><ThemeProvider><AuthProvider><Telemetry /><IconSymbols /><AppRoutes /></AuthProvider></ThemeProvider></BrowserRouter>;
}
