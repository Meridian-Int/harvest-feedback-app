import { generateKeyPairSync } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { readGa4Traffic } from './ga4-traffic';

const config = { secretArn: 'arn:aws:secretsmanager:us-east-2:938463256739:secret:harvest-refresh/staging/google-analytics-AbCd12', propertyId: '123456789' };

it('returns labelled sample mode without the existing HARVEST GA4 configuration', async () => {
  const secret = vi.fn();
  const request = vi.fn();
  expect(await readGa4Traffic({}, secret, request)).toEqual({ configured: false, users: 0, sessions: 0, pageViews: 0, days: [], pages: [] });
  expect(secret).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

it('reads seven-day live users, sessions and top pages with a server-side service account', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const secret = vi.fn().mockResolvedValue(JSON.stringify({ client_email: 'harvest@example.iam.gserviceaccount.com', private_key: privateKey }));
  const request = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'short-lived-token' }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ rows: [{ metricValues: [{ value: '42' }, { value: '60' }, { value: '120' }] }] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ rows: [{ dimensionValues: [{ value: '20261014' }], metricValues: [{ value: '12' }] }] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ rows: [{ dimensionValues: [{ value: '/data-room' }], metricValues: [{ value: '34' }] }] }), { status: 200 }));
  const result = await readGa4Traffic(config, secret, request, Date.UTC(2026, 9, 15));
  expect(secret).toHaveBeenCalledWith(config.secretArn);
  expect(request.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
  expect(String(request.mock.calls[0][1].body)).toContain('jwt-bearer');
  expect(request.mock.calls.slice(1).every(([url, init]) => url === 'https://analyticsdata.googleapis.com/v1beta/properties/123456789:runReport' && init.headers.authorization === 'Bearer short-lived-token')).toBe(true);
  expect(result).toEqual({ configured: true, users: 42, sessions: 60, pageViews: 120, days: [{ day: '20261014', users: 12 }], pages: [{ name: '/data-room', views: 34 }] });
});

it('rejects failed Google calls without exposing credential or response contents', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const credential = JSON.stringify({ client_email: 'harvest@example.iam.gserviceaccount.com', private_key: privateKey });
  const request = vi.fn().mockResolvedValue(new Response(credential, { status: 403 }));
  await expect(readGa4Traffic(config, async () => credential, request)).rejects.toThrow('Google authentication failed (403).');
  expect(request).toHaveBeenCalledOnce();
});
