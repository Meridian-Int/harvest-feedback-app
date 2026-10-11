import { useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Field, Input, ThemeToggle } from '../components/ui';
import { beginAccountSignIn, requestAccountPasswordSetup, completeAccountPasswordSetup, confirmSignIn, createAccountPassword, finishAccountPasswordSignIn, hasAccountPassword, isAdmin } from '../lib/auth';
import { useAuth } from './AuthProvider';

export function SignInPage() {
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'password' | 'setup' | 'reset'>(user?.needsPasswordSetup ? 'setup' : 'email');
  const [code, setCode] = useState('');
  const emailInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const passwordInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user && !user.needsPasswordSetup) return <Navigate to={isAdmin(user) ? '/admin/reviews' : '/feedback/new'} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (step === 'email') { setStep(await beginAccountSignIn(email)); }
      else if (step === 'code') {
        const verified = await confirmSignIn(code);
        if (await hasAccountPassword()) setUser(verified);
        else setStep('setup');
        setCode('');
      } else if (step === 'reset') {
        setUser(await completeAccountPasswordSetup(email, code, password, confirmation)); setCode(''); setPassword(''); setConfirmation('');
      } else if (step === 'setup') {
        setUser(await createAccountPassword(password, confirmation)); setPassword(''); setConfirmation('');
      } else { setUser(await finishAccountPasswordSignIn(password)); setPassword(''); }
    } catch (e) { setError((e as Error).message); (step === 'email' ? emailInput : step === 'code' ? codeInput : passwordInput).current?.focus(); }
    finally { setBusy(false); }
  }
  return <section className="auth-screen" aria-labelledby="auth-heading">
    <div className="auth-top"><span>HARVEST</span><ThemeToggle /></div>
    <div className="auth-card glass">
      <div className="auth-brand">Meridian<br />Intelligence</div><div className="auth-divider" />
      <h1 id="auth-heading">{step === 'setup' || step === 'reset' ? 'Create your password' : step === 'code' ? 'Verify your email' : 'Sign in to Harvest'}</h1>
      <p className="auth-subtitle">{step === 'setup' ? 'Sign in with your password next time to follow your reports.' : 'A place to share feedback and follow its progress.'}</p>
      <form onSubmit={submit} noValidate>
        {step === 'email' && <Field label="Work email" htmlFor="auth-email"><Input ref={emailInput} autoFocus id="auth-email" type="email" autoComplete="email" placeholder="you@company.com" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'auth-error' : undefined} /></Field>}
        {step === 'code' && <><Field label="Verification code" htmlFor="auth-code"><Input ref={codeInput} autoFocus id="auth-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} value={code} onChange={event => setCode(event.target.value)} required /></Field><p className="helper">Enter the 8-digit code sent to your work email to set up your password.</p></>}
        {step === 'reset' && <Field label="Verification code" htmlFor="auth-code"><Input ref={codeInput} autoFocus id="auth-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required value={code} onChange={event => setCode(event.target.value)} /><span className="helper">Enter the code sent to your work email.</span></Field>}
        {step === 'password' && <p className="helper">{email.trim()}</p>}
        {(step === 'setup' || step === 'reset' || step === 'password') && <Field label={step === 'setup' || step === 'reset' ? 'Create password' : 'Password'} htmlFor="auth-password"><Input ref={passwordInput} autoFocus id="auth-password" type="password" autoComplete={step === 'setup' || step === 'reset' ? 'new-password' : 'current-password'} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'auth-error' : undefined} /></Field>}
        {(step === 'setup' || step === 'reset') && <><Field label="Confirm password" htmlFor="auth-confirmation"><Input id="auth-confirmation" type="password" autoComplete="new-password" maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></Field><p className="helper">At least 12 characters, including uppercase, lowercase, a number and a symbol.</p></>}
        <Button type="submit" variant="primary" className="auth-continue w-full" disabled={busy}>{step === 'email' ? 'Continue' : step === 'code' ? 'Verify email' : step === 'setup' || step === 'reset' ? 'Save password and continue' : 'Sign in'}</Button>
        {step === 'password' && <Button type="button" variant="quiet" disabled={busy} onClick={async () => {
          setBusy(true); setError(null);
          try { await requestAccountPasswordSetup(email); setPassword(''); setConfirmation(''); setCode(''); setStep('reset'); }
          catch (cause) { setError((cause as Error).message); }
          finally { setBusy(false); }
        }}>Set or reset password</Button>}
      </form>
      {error && <p className="error" id="auth-error" role="alert">{error}</p>}
      <p className="helper auth-guidance">Use your work email.</p>
    </div>
    <div className="auth-bottom">HARVEST · By Meridian Intelligence</div>
  </section>;
}
