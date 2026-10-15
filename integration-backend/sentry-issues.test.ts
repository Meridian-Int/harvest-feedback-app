import { expect, it, vi } from 'vitest';
import { readSentryIssues } from './sentry-issues';

const config = { secretArn: 'arn:aws:secretsmanager:us-east-2:938463256739:secret:feedback-read-AbCd12', org: 'meridian-zt', project: 'javascript-react', environment: 'prestaging' };

it('stays in sample mode without a configured token secret', async () => {
  const token = vi.fn();
  const request = vi.fn();
  expect(await readSentryIssues({ ...config, secretArn: undefined }, token, request)).toEqual({ configured: false, issues: [] });
  expect(token).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

it('reads only prestaging issues from the existing HARVEST Sentry project', async () => {
  const token = vi.fn().mockResolvedValue('private-token');
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
    id: '42', title: 'Timeout', culprit: 'HARVEST', project: { slug: 'javascript-react' },
    level: 'error', count: '12', userCount: 3, lastSeen: '2026-10-15T00:00:00Z',
    permalink: 'https://sentry.io/issues/42/', stats: { '24h': [[1, 2], [2, 4]] },
  }]), { status: 200 }));
  const result = await readSentryIssues(config, token, request);
  expect(token).toHaveBeenCalledWith(config.secretArn);
  const url = request.mock.calls[0][0] as URL;
  expect(url.origin).toBe('https://sentry.io');
  expect(url.pathname).toBe('/api/0/organizations/meridian-zt/issues/');
  expect(url.searchParams.get('project')).toBe('javascript-react');
  expect(url.searchParams.get('environment')).toBe('prestaging');
  expect(url.searchParams.get('query')).toBe('is:unresolved');
  expect(request.mock.calls[0][1].headers.Authorization).toBe('Bearer private-token');
  expect(result).toEqual({ configured: true, issues: [{ id: '42', title: 'Timeout', culprit: 'HARVEST', project: 'javascript-react', level: 'error', count: 12, userCount: 3, lastSeen: '2026-10-15T00:00:00Z', permalink: 'https://sentry.io/issues/42/', trend: [2, 4] }] });
});

it('reports an API error without exposing its body or token', async () => {
  const request = vi.fn().mockResolvedValue(new Response('private-token', { status: 403 }));
  await expect(readSentryIssues(config, async () => 'private-token', request)).rejects.toThrow('Sentry issues request failed (403).');
});
