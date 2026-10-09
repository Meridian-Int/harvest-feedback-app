export interface InviteInput { email: string; name: string; company: string }

export function validateInvite(input: InviteInput): InviteInput {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const company = input.company.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid work email.');
  if (!name || name.length > 100) throw new Error('Enter a partner name (up to 100 characters).');
  if (!company || company.length > 128) throw new Error('Enter a company name (up to 128 characters).');
  return { email, name, company };
}
