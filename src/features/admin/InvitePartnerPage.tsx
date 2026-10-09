import { useState, type FormEvent } from 'react';
import { Button, Field, Input, Panel } from '../../components/ui';
import { invitePartner } from '../../lib/invitations';
import './invite.css';

export function InvitePartnerPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSentTo(null);
    try {
      const invited = await invitePartner({ email, name, company });
      setSentTo(invited);
      setEmail(''); setName(''); setCompany('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the invitation.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="invite-page">
    <div className="pagehead"><div><h1>Invite a partner</h1><p>Give a partner access to submit and track feedback.</p></div></div>
    <Panel className="invite-panel" heading="Partner details">
      <form onSubmit={event => { void submit(event); }}>
        <Field label="Work email" htmlFor="invite-email" required><Input id="invite-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></Field>
        <Field label="Partner name" htmlFor="invite-name" required><Input id="invite-name" autoComplete="name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></Field>
        <Field label="Company" htmlFor="invite-company" required><Input id="invite-company" autoComplete="organization" required maxLength={128} value={company} onChange={event => setCompany(event.target.value)} /></Field>
        <p className="helper">The partner will receive an invitation email and sign in with a one-time code. Their access is assigned by their email.</p>
        {error && <p className="error" role="alert">{error}</p>}
        {sentTo && <p className="invite-success" role="status">Invitation sent to {sentTo}.</p>}
        <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Sending invitation…' : 'Send invitation'}</Button>
      </form>
    </Panel>
  </section>;
}
