import { verificationEmail } from '../email-content';

interface Event { triggerSource: string; request: { codeParameter: string }; response: { emailSubject?: string; emailMessage?: string } }
export async function handler(event: Event): Promise<Event> {
  if (['CustomMessage_SignUp', 'CustomMessage_ResendCode', 'CustomMessage_ForgotPassword', 'CustomMessage_Authentication'].includes(event.triggerSource)) {
    const reset = event.triggerSource === 'CustomMessage_ForgotPassword';
    const email = verificationEmail({ code: '{####}', expiresInMinutes: reset ? 60 : event.triggerSource === 'CustomMessage_Authentication' ? 3 : 1440, purpose: reset ? 'password-reset' : 'signup' });
    event.response.emailSubject = email.subject;
    // Cognito replaces its placeholder with the issued code; the renderer never generates one.
    event.response.emailMessage = email.html.replace('{####}', event.request.codeParameter);
  }
  return event;
}
