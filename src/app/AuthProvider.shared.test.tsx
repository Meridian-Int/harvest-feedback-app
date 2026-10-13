import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthProvider';
import { restoreSession } from '../lib/auth';
vi.mock('../lib/auth', () => ({ restoreSession: vi.fn(), signOut: vi.fn() }));
vi.mock('../lib/amplify', () => ({ isHarvestSharedSessionMode: () => true }));
vi.mock('../lib/harvest-shared-session', () => ({ HARVEST_SESSION_KEY: 'harvest-refresh.session.v1' }));
function Viewer() { const { user } = useAuth(); return <span>{user?.email}</span>; }
const user = { id: 'sub', email: 'company@example.com', name: 'Company', persona: 'Company', company: 'Company', groups: [] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(restoreSession).mockResolvedValue(user as never); });
it('drops the Feedback workspace after HARVEST signs out in another tab', async () => {
  render(<AuthProvider><Viewer /></AuthProvider>);
  await screen.findByText('company@example.com');
  vi.mocked(restoreSession).mockResolvedValue(null);
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'harvest-refresh.session.v1', newValue: null })); });
  await screen.findByRole('alert');
  expect(screen.queryByText('company@example.com')).not.toBeInTheDocument();
});
it('adopts a changed account and ignores a late restoration of the old account', async () => {
  let resolveOld: (value: any) => void = () => {};
  vi.mocked(restoreSession).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  render(<AuthProvider><Viewer /></AuthProvider>);
  vi.mocked(restoreSession).mockResolvedValue({ ...user, email: 'partner@example.com' } as never);
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'harvest-refresh.session.v1' })); });
  await screen.findByText('partner@example.com');
  await act(async () => { resolveOld(user); });
  expect(screen.queryByText('company@example.com')).not.toBeInTheDocument();
});
it('revalidates membership on focus and fails closed after revocation', async () => {
  render(<AuthProvider><Viewer /></AuthProvider>);
  await screen.findByText('company@example.com');
  vi.mocked(restoreSession).mockRejectedValue(new Error('Membership revoked'));
  act(() => { window.dispatchEvent(new Event('focus')); });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Membership revoked'));
  expect(screen.queryByText('company@example.com')).not.toBeInTheDocument();
});
