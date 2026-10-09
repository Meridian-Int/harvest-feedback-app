import { useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Field, Input, TextButton, ThemeToggle } from '../components/ui';
import { confirmSignIn, isAdmin, signIn } from '../lib/auth';
import { useAuth } from './AuthProvider';

export function SignInPage() {
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
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
      else setUser(await confirmSignIn(code));
    } catch (e) { setError((e as Error).message); (step === 'email' ? emailInput : codeInput).current?.focus(); }
    finally { setBusy(false); }
  }
  return <section className="auth-screen" aria-labelledby="auth-heading">
    <div className="auth-top"><span>HARVEST</span><ThemeToggle /></div>
    <div className="auth-card glass">
      <div className="auth-brand">Meridian<br />Intelligence</div><div className="auth-divider" />
      <h1 id="auth-heading">{step === 'email' ? 'Sign in to Harvest' : 'Verify your email'}</h1>
      <p className="auth-subtitle">{step === 'email' ? 'A place to share feedback and follow its progress.' : `Continue as ${email.trim()}`}</p>
      <form onSubmit={submit} noValidate>
        {step === 'email' ? <Field label="Work email" htmlFor="auth-email"><Input ref={emailInput} id="auth-email" type="email" autoComplete="email" placeholder="you@company.com" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'auth-error' : undefined} /></Field> : <>
          <Field label="Verification code" htmlFor="auth-code"><Input ref={codeInput} autoFocus id="auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required value={code} onChange={event => setCode(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'auth-error' : undefined} /></Field>
          <p className="helper">Enter the 6-digit code sent to your work email.</p>
        </>}
        <Button type="submit" variant="primary" className="auth-continue w-full" disabled={busy}>{step === 'email' ? 'Continue with email' : 'Open workspace'}</Button>
        {step === 'code' && <TextButton id="auth-back" disabled={busy} onClick={() => { setStep('email'); setError(null); setCode(''); window.setTimeout(() => emailInput.current?.focus(), 0); }}>Use a different email</TextButton>}
      </form>
      {error && <p className="error" id="auth-error" role="alert">{error}</p>}
      <p className="helper auth-invitation">Use the work email associated with your invitation.</p>
    </div>
    <div className="auth-bottom">HARVEST · By Meridian Intelligence</div>
  </section>;
}
