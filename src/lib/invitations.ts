import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { requireAmplify } from './amplify';
import { isAdmin, requireUser } from './auth';

const client = generateClient<Schema>();

export async function invitePartner(input: { email: string; name: string; company: string }): Promise<string> {
  requireAmplify();
  if (!isAdmin(requireUser())) throw new Error('Admin access required.');
  const response = await client.mutations.invitePartner(input);
  if (response.errors?.length) throw new Error(response.errors[0].message);
  if (!response.data) throw new Error('Could not send the invitation.');
  return response.data;
}
