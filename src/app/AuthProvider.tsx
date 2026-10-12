import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { restoreSession, signOut } from '../lib/auth';
import { isHarvestSharedSessionMode } from '../lib/amplify';
import type { AuthUser } from '../lib/types';

const AuthContext = createContext<{ user: AuthUser | null; setUser: (user: AuthUser | null) => void; logOut: () => Promise<void> } | null>(null);
export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser?: AuthUser | null }) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);
  const [ready, setReady] = useState(initialUser !== undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (initialUser !== undefined) return;
    let active = true;
    restoreSession().then(value => {
      if (active) setUser(value);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not restore your sign-in.');
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [initialUser]);
  async function logOut() {
    if (isHarvestSharedSessionMode()) { window.location.assign('/'); return; }
    await signOut(); setUser(null);
  }
  if (!ready) return <div role="status">Opening Harvest…</div>;
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
