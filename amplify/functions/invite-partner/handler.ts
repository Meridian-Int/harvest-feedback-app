import { AdminCreateUserCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { validateInvite, type InviteInput } from './validation';

const cognito = new CognitoIdentityProviderClient({});

export async function handler(event: { arguments: InviteInput }): Promise<string> {
  const { email, name, company } = validateInvite(event.arguments);
  const poolId = process.env.USER_POOL_ID;
  if (!poolId) throw new Error('Invitations are not configured.');
  try {
    await cognito.send(new AdminCreateUserCommand({
      UserPoolId: poolId,
      Username: email,
      DesiredDeliveryMediums: ['EMAIL'],
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: name },
        { Name: 'custom:persona', Value: 'Partner' },
        { Name: 'custom:company', Value: company },
      ],
      // Email OTP is the first sign-in factor; do not set a temporary password.
    }));
    return email;
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'UsernameExistsException') throw new Error('This email already has access.');
    throw cause;
  }
}
