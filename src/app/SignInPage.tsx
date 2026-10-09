import { useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Field, Input, TextButton, ThemeToggle } from '../components/ui';
import { confirmSignIn, createAccountPassword, hasAccountPassword, isAdmin, signIn, signInWithPassword } from '../lib/auth';
import type { AuthUser } from '../lib/types';
import { useAuth } from './AuthProvider';

export function SignInPage() {
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'password' | 'setup'>('email');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [verifiedUser, setVerifiedUser] = useState<AuthUser | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  if (user) return <Navigate to={isAdmin(user) ? '/admin/reviews' : '/feedback/new'} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (step === 'email') { await signIn(email); setStep('code'); setCode(''); }
      else if (step === 'code') {
        const verified = await confirmSignIn(code); setCode('');
        // Password setup is optional; a factor lookup failure must not discard a valid OTP session.
        let passwordExists = true;
        try { passwordExists = await hasAccountPassword(); } catch { /* Continue with the verified email session. */ }
        if (passwordExists) setUser(verified);
        else { setVerifiedUser(verified); setStep('setup'); }
      } else if (step === 'setup') {
        setUser(await createAccountPassword(password, confirmation)); setPassword(''); setConfirmation('');
      } else { setUser(await signInWithPassword(email, password)); setPassword(''); }
    } catch (e) { setError((e as Error).message); (step === 'email' ? emailInput : step === 'code' ? codeInput : passwordInput).current?.focus(); }
    finally { setBusy(false); }
  }
  return <section className="auth-screen" aria-labelledby="auth-heading">
    <div className="auth-top"><span>HARVEST</span><ThemeToggle /></div>
    <div className="auth-card glass">
      <div className="auth-brand">Meridian<br />Intelligence</div><div className="auth-divider" />
      <h1 id="auth-heading">{step === 'setup' ? 'Create your password' : step === 'code' ? 'Verify your email' : 'Sign in to Harvest'}</h1>
      <p className="auth-subtitle">{step === 'setup' ? 'Sign in with your password next time to follow your reports.' : step === 'code' ? `Continue as ${email.trim()}` : 'A place to share feedback and follow its progress.'}</p>
      <form onSubmit={submit} noValidate>
        {(step === 'email' || step === 'password') ? <Field label="Work email" htmlFor="auth-email"><Input ref={emailInput} id="auth-email" type="email" autoComplete="email" placeholder="you@company.com" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'auth-error' : undefined} /></Field> : step === 'code' ? <>
          <Field label="Verification code" htmlFor="auth-code"><Input ref={codeInput} autoFocus id="auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} placeholder="00000000" required value={code} onChange={event => setCode(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'auth-error' : undefined} /></Field>
          <p className="helper">Enter the 8-digit code sent to your work email.</p>
        </> : null}
        {(step === 'setup' || step === 'password') && <Field label={step === 'setup' ? 'Create password' : 'Password'} htmlFor="auth-password"><Input ref={passwordInput} autoFocus id="auth-password" type="password" autoComplete={step === 'setup' ? 'new-password' : 'current-password'} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'auth-error' : undefined} /></Field>}
        {step === 'setup' && <><Field label="Confirm password" htmlFor="auth-confirmation"><Input id="auth-confirmation" type="password" autoComplete="new-password" maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></Field><p className="helper">At least 12 characters, including uppercase, lowercase, a number and a symbol.</p></>}
        <Button type="submit" variant="primary" className="auth-continue w-full" disabled={busy}>{step === 'email' ? 'Continue with email' : step === 'setup' ? 'Save password and continue' : step === 'password' ? 'Sign in' : 'Open workspace'}</Button>
        {step === 'email' && <TextButton disabled={busy} onClick={() => { setStep('password'); setError(null); }}>Sign in with password</TextButton>}
        {step === 'setup' && <TextButton disabled={busy} onClick={() => { setPassword(''); setConfirmation(''); setUser(verifiedUser); }}>Continue with email code only</TextButton>}
        {(step === 'code' || step === 'password') && <TextButton id="auth-back" disabled={busy} onClick={() => { setStep('email'); setError(null); setCode(''); setPassword(''); window.setTimeout(() => emailInput.current?.focus(), 0); }}>{step === 'password' ? 'Use an email code instead' : 'Use a different email'}</TextButton>}
      </form>
      {error && <p className="error" id="auth-error" role="alert">{error}</p>}
      <p className="helper auth-invitation">Use the work email associated with your invitation.</p>
    </div>
    <div className="auth-bottom">HARVEST · By Meridian Intelligence</div>
  </section>;
}
