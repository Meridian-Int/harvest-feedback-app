import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { restoreSession, signOut } from '../lib/auth';
import { HARVEST_SESSION_KEY } from '../lib/harvest-shared-session';
import { isHarvestSharedSessionMode } from '../lib/amplify';
import type { AuthUser } from '../lib/types';
import { OpeningFeedbackScreen } from './OpeningFeedbackScreen';

const AuthContext = createContext<{ user: AuthUser | null; setUser: (user: AuthUser | null) => void; logOut: () => Promise<void> } | null>(null);
export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser?: AuthUser | null }) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);
  const [ready, setReady] = useState(initialUser !== undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (initialUser !== undefined) return;
    let active = true;
    let generation = 0;
    const synchronize = (reset = true) => {
      const current = ++generation;
      setError(null);
      if (reset) { setReady(false); setUser(null); }
      void restoreSession().then(value => {
        if (active && current === generation) setUser(value);
      }).catch((cause: unknown) => {
        if (active && current === generation) { setUser(null); setError(cause instanceof Error ? cause.message : 'Could not restore your sign-in.'); }
      }).finally(() => {
        if (active && current === generation) setReady(true);
      });
    };
    const changed = (event: StorageEvent) => {
      if (event.key === HARVEST_SESSION_KEY || event.key === null) synchronize();
    };
    const focused = () => synchronize(false);
    synchronize();
    if (isHarvestSharedSessionMode()) {
      window.addEventListener('storage', changed);
      window.addEventListener('focus', focused);
    }
    return () => {
      active = false;
      window.removeEventListener('storage', changed);
      window.removeEventListener('focus', focused);
    };
  }, [initialUser]);
  async function logOut() {
    if (isHarvestSharedSessionMode()) { window.location.assign('/'); return; }
    await signOut(); setUser(null);
  }
  if (!ready) return <OpeningFeedbackScreen />;
  if (error) return <div role="alert">{error}</div>;
  if (!user && isHarvestSharedSessionMode()) {
    return <div role="alert">Open Feedback from your HARVEST workspace. <a href="/">Return to HARVEST</a></div>;
  }
  return <AuthContext.Provider value={{ user, setUser, logOut }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required.');
  return context;
}
