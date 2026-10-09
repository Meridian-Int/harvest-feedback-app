import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { restoreSession, signOut } from '../lib/auth';
import type { AuthUser } from '../lib/types';

const AuthContext = createContext<{ user: AuthUser | null; setUser: (user: AuthUser | null) => void; logOut: () => Promise<void> } | null>(null);
export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser?: AuthUser | null }) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);
  const [ready, setReady] = useState(initialUser !== undefined);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (initialUser !== undefined) return;
    let active = true;
    restoreSession().then(value => {
      if (active) setUser(value);
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [initialUser]);
  async function logOut() { await signOut(); setUser(null); }
  if (!ready) return <div role="status">Opening Harvest…</div>;
  if (error) return <div role="alert">Could not restore your sign-in. Refresh the page to try again.</div>;
  return <AuthContext.Provider value={{ user, setUser, logOut }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required.');
  return context;
}
