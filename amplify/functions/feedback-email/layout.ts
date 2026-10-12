import { feedbackMarkContentId } from './brand';

function escaped(text: string): string {
  return text.replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]!));
}

/** Feedback-only email layout built from the user's attached screenshots. */
export function renderFeedbackEmail(message: { heading: string; paragraphs: string[]; ctaUrl?: string; footnote?: string }): string {
  const body = message.paragraphs.map(text => {
    const detail = /^(Report ID|Report|Status|Feedback type|Priority|Account type): ([\s\S]*)$/.exec(text);
    const content = detail ? `<strong>${escaped(detail[1])}:</strong> ${escaped(detail[2])}` : escaped(text);
    return `<p style="margin:0 0 ${detail ? '8px' : '12px'};font-size:14px;line-height:1.5;overflow-wrap:anywhere;">${content}</p>`;
  }).join('');
  const action = message.ctaUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 12px;"><tr><td bgcolor="#b65743" style="border-radius:28px;"><a href="${escaped(message.ctaUrl)}" style="display:inline-block;padding:12px 24px;border-radius:28px;background:#b65743;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">View report</a></td></tr></table>` : '';
  const note = message.footnote ? `<p style="margin:0;font-size:12px;line-height:1.5;color:#647168;">${escaped(message.footnote)}</p>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escaped(message.heading)}</title>
<style>@media(max-width:620px){.feedback-outer{padding:12px 8px!important}.feedback-card{padding:20px!important}.feedback-footer{padding:12px 20px!important}.feedback-title{font-size:22px!important}}</style></head>
<body style="margin:0;padding:0;background:#f7f5ef;color:#183a32;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escaped(message.heading)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f7f5ef"><tr><td align="center" class="feedback-outer" style="padding:16px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;"><tr><td class="feedback-card" bgcolor="#fffdf9" style="padding:24px;border-radius:18px;background:#fffdf9;color:#183a32;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td valign="middle" width="32"><img src="cid:${feedbackMarkContentId}" width="32" height="32" alt="HARVEST mark" style="display:block;border:0;width:32px;height:32px;"></td><td valign="middle" style="padding-left:12px;font-size:16px;letter-spacing:3px;font-weight:700;color:#183a32;">HARVEST</td></tr></table>
<h1 class="feedback-title" style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:#183a32;">${escaped(message.heading)}</h1>
${body}${action}${note}
</td></tr><tr><td class="feedback-footer" style="padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#647168;">HARVEST by Meridian Intelligence. This message is about your feedback report.</td></tr></table>
</td></tr></table></body></html>`;
}
