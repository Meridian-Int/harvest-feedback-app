import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Field, Input, Select, ThemeToggle } from '../components/ui';
import { createAccountPassword, hasAccountPassword, isAdmin, saveClientPersona, validateNewPassword } from '../lib/auth';
import { useAuth } from './AuthProvider';

export function AccountSetupPage() {
  const { user, setUser } = useAuth();
  const [persona, setPersona] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (user?.needsPersonaSetup) hasAccountPassword().then(value => { if (active) setHasPassword(value); }).catch(cause => { if (active) setError((cause as Error).message); });
    return () => { active = false; };
  }, [user?.id, user?.needsPersonaSetup]);
  if (!user) return <Navigate to="/sign-in" replace />;
  if (isAdmin(user) || !user.needsPersonaSetup) return <Navigate to={isAdmin(user) ? '/admin/reviews' : '/feedback/new'} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (persona !== 'Company' && persona !== 'Partner') { setError('Choose Company or Partner.'); return; }
    if (hasPassword == null) return;
    setBusy(true);
    try {
      if (!hasPassword) {
        validateNewPassword(password, confirmation);
        await createAccountPassword(password, confirmation);
        setHasPassword(true); setPassword(''); setConfirmation('');
      }
      setUser(await saveClientPersona(persona));
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="auth-screen" aria-labelledby="setup-heading">
    <div className="auth-top"><span>HARVEST</span><ThemeToggle /></div>
    <div className="auth-card glass">
      <div className="auth-brand">Meridian<br />Intelligence</div><div className="auth-divider" />
      <h1 id="setup-heading">Set up your account</h1>
      <p className="auth-subtitle">Choose your account type once. Your reports will use it automatically.</p>
      <form onSubmit={submit} noValidate>
        <Field label="Account type" htmlFor="setup-persona"><Select id="setup-persona" value={persona} required onChange={event => setPersona(event.target.value)}><option value="">Choose Company or Partner</option><option value="Company">Company</option><option value="Partner">Partner</option></Select></Field>
        {hasPassword === false && <><Field label="Create password" htmlFor="setup-password"><Input id="setup-password" type="password" autoComplete="new-password" maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></Field><Field label="Confirm password" htmlFor="setup-confirmation"><Input id="setup-confirmation" type="password" autoComplete="new-password" maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></Field><p className="helper">At least 12 characters, including uppercase, lowercase, a number and a symbol.</p></>}
        {hasPassword === true && <p className="helper">Your password is already set. Use Sign in with password next time.</p>}
        <Button type="submit" variant="primary" className="auth-continue w-full" disabled={busy || hasPassword == null}>{busy ? 'Saving…' : 'Save account and continue'}</Button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
    <div className="auth-bottom">HARVEST · By Meridian Intelligence</div>
  </section>;
}
