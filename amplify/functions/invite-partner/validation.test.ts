import { expect, it } from 'vitest';
import { validateInvite } from './validation';

it('normalizes the invited partner details', () => {
  expect(validateInvite({ email: ' Partner@Example.com ', name: ' Pat Lee ', company: ' Meridian ' }))
    .toEqual({ email: 'partner@example.com', name: 'Pat Lee', company: 'Meridian' });
});

it('rejects incomplete or invalid partner details', () => {
  expect(() => validateInvite({ email: 'bad', name: 'Pat', company: 'Meridian' })).toThrow('valid work email');
  expect(() => validateInvite({ email: 'pat@example.com', name: '', company: 'Meridian' })).toThrow('partner name');
  expect(() => validateInvite({ email: 'pat@example.com', name: 'Pat', company: '' })).toThrow('company name');
});
