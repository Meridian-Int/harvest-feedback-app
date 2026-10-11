/** Provider-neutral email content. Delivery and token issuance belong to the backend. */
export interface HarvestEmail {
  subject: string;
  html: string;
  text: string;
}

// Inline equivalents of the platform's light theme (docs/design/tokens.css).
// Both heading and content references supplied by the user use a serif face.
const palette = { background: '#e7e2d8', card: '#eee9df', ink: '#302e28', muted: '#555147', accent: '#36332c', accentInk: '#f1ece2', line: '#cdc5b7', input: '#e9e3d7' };
// Same light-theme haze as the platform; solid background remains the email fallback.
const background = `background-color:${palette.background};background-image:radial-gradient(ellipse 65% 50% at 92% 0%, rgba(204,130,63,.065), transparent 72%),radial-gradient(ellipse 50% 55% at 0% 100%, rgba(204,130,63,.03), transparent 75%);`;
const font = "Georgia,'Times New Roman',serif";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function httpsLink(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Email links must use HTTPS without credentials.');
  return escapeHtml(url.href);
}

function shell(title: string, preview: string, content: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;${background}color:${palette.ink};font-family:${font};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${background}"><tr><td align="center" style="padding:20px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${palette.card};border:1px solid ${palette.line};border-radius:18px;"><tr><td style="padding:28px 24px;">
<p style="margin:0 0 24px;font-family:${font};font-size:16px;font-weight:400;letter-spacing:2px;color:${palette.ink};">HARVEST</p>
<h1 style="margin:0 0 18px;font-family:${font};font-size:22px;line-height:1.4;font-weight:400;letter-spacing:0;color:${palette.ink};">${escapeHtml(title)}</h1>
${content}
<p style="margin:24px 0 0;font-size:11px;color:${palette.muted};">HARVEST · By Meridian Intelligence</p>
</td></tr></table></td></tr></table></body></html>`;
}

function paragraph(content: string): string {
  return `<p style="margin:0 0 18px;font-family:${font};font-size:14px;line-height:1.6;">${content}</p>`;
}

export function invitationEmail(input: { signInUrl: string }): HarvestEmail {
  const link = httpsLink(input.signInUrl);
  const title = 'HARVEST has invited you to share your feedback';
  const introduction = 'Your experience matters. Share your feedback to help us improve HARVEST.';
  const instructions = 'Sign in with your work email using the verification code we send you.';
  // This is a sign-in link, not a token. Do not claim an expiry or single-use property.
  return {
    subject: 'You’re invited to share your feedback with HARVEST',
    html: shell(title, introduction, paragraph(introduction) + paragraph(instructions) +
      `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${palette.accent}" style="border-radius:7px;text-align:center;"><a href="${link}" style="display:inline-block;padding:12px 20px;color:${palette.accentInk};font-family:${font};font-size:14px;font-weight:400;text-decoration:none;border-radius:7px;">Share feedback</a></td></tr></table>` +
      `<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${palette.muted};">If the button doesn’t work, <a href="${link}" style="color:${palette.ink};">open HARVEST Feedback</a>. Not expecting this invitation? You can ignore this email.</p>`),
    text: `${title}\n\n${introduction}\n\n${instructions}\n\nShare feedback: ${input.signInUrl}\n\nNot expecting this invitation? You can ignore this email.\n\nHARVEST · By Meridian Intelligence`,
  };
}

export function verificationEmail(input: { code: string; expiresInMinutes: number; purpose?: 'signup' | 'password-reset' | 'initial-setup' }): HarvestEmail {
  if (!/^\d{6,8}$/.test(input.code) && input.code !== '{####}') throw new Error('Use the verification code issued by the authentication provider.');
  if (!Number.isInteger(input.expiresInMinutes) || input.expiresInMinutes < 1) throw new Error('Use the actual code lifetime in whole minutes.');
  const title = input.purpose === 'password-reset' ? 'Reset your password' : 'Verify your email';
  const introduction = input.purpose === 'password-reset' ? 'Use this code to reset your HARVEST Feedback password.' : 'Use this verification code to verify your HARVEST Feedback account.';
  const instructions = input.purpose === 'password-reset' ? 'Enter it on the password reset page.' : 'Enter it on the verification page, then create your password.';
  const expiry = `This code expires in ${input.expiresInMinutes} ${input.expiresInMinutes === 1 ? 'minute' : 'minutes'}.`;
  return {
    subject: 'Your HARVEST Feedback verification code',
    html: shell(title, introduction, paragraph(introduction) +
      `<p style="margin:0 0 18px;padding:16px 12px;background:${palette.input};border:1px solid ${palette.line};border-radius:7px;text-align:center;font-family:${font};font-size:28px;letter-spacing:5px;font-weight:400;">${input.code}</p>` +
      paragraph(`${expiry} ${instructions}`) +
      `<p style="margin:0;font-size:12px;line-height:1.6;color:${palette.muted};">Don’t share this code with anyone. If you didn’t request it, you can ignore this email.</p>`),
    text: `${title}\n\n${introduction}\n\n${input.code}\n\n${expiry} ${instructions}\n\nDon’t share this code with anyone. If you didn’t request it, you can ignore this email.\n\nHARVEST · By Meridian Intelligence`,
  };
}

export type FeedbackEmailKind = 'client-submitted' | 'admin-submitted' | 'update-requested' | 'admin-updated' | 'closed';

/** Content only: the backend must select recipients from trusted report ownership. */
export function feedbackEmail(input: {
  kind: FeedbackEmailKind;
  reportId: string;
  reportTitle: string;
  reportUrl: string;
  reporterName?: string;
  status?: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
}): HarvestEmail {
  const messages: Record<FeedbackEmailKind, [string, string]> = {
    'client-submitted': ['Your feedback was submitted', 'You’ve successfully submitted your report. We’ll email you when it is updated.'],
    'admin-submitted': ['New feedback submitted', `${input.reporterName || 'A client'} has submitted new feedback.`],
    'update-requested': ['An update was requested', `${input.reporterName || 'A client'} has requested an update on their report.`],
    'admin-updated': ['Your report was updated', 'An administrator has updated your report.'],
    closed: ['Your report was closed', 'Your feedback report has been closed. Thank you for helping us improve HARVEST.'],
  };
  const message = messages[input.kind];
  if (!message || !input.reportId.trim() || !input.reportTitle.trim()) throw new Error('A valid feedback event and report are required.');
  const [title, introduction] = message;
  const link = httpsLink(input.reportUrl);
  const statuses = { NEW: 'New', ASSIGNED: 'Assigned', IN_PROGRESS: 'In Progress', CLOSED: 'Completed / Closed' };
  const displayId = `FB-${input.reportId.slice(-4).toUpperCase()}`;
  const status = input.status ? statuses[input.status] : undefined;
  if (input.status && !status) throw new Error('Invalid feedback status.');
  const summary = `${displayId}: ${input.reportTitle}`;
  return {
    subject: `HARVEST Feedback · ${title} · ${displayId}`,
    html: shell(title, introduction, paragraph(escapeHtml(introduction)) + paragraph(escapeHtml(summary)) +
      (status ? paragraph(`Status: ${escapeHtml(status)}`) : '') +
      `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${palette.accent}" style="border-radius:7px;text-align:center;"><a href="${link}" style="display:inline-block;padding:12px 20px;color:${palette.accentInk};font-family:${font};font-size:14px;font-weight:400;text-decoration:none;border-radius:7px;">View report</a></td></tr></table>`),
    text: `${title}\n\n${introduction}\n\n${summary}${status ? `\nStatus: ${status}` : ''}\n\nView report: ${input.reportUrl}\n\nHARVEST · By Meridian Intelligence`,
  };
}
