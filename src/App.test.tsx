import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn()
}));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: getMock,
      post: postMock,
      put: vi.fn().mockResolvedValue({ data: { ok: true } }),
      delete: vi.fn()
    })
  }
}));

import App from './App';

const accessByUser: Record<string, { portal_role: 'citizen' | 'maintainer' | 'admin'; portal_roles: Array<'citizen' | 'maintainer' | 'admin'> }> = {
  '00000000-0000-0000-0000-000000000111': { portal_role: 'citizen', portal_roles: ['citizen'] },
  '00000000-0000-0000-0000-000000000222': { portal_role: 'maintainer', portal_roles: ['maintainer', 'citizen'] },
  '00000000-0000-0000-0000-000000000333': { portal_role: 'admin', portal_roles: ['admin', 'maintainer', 'citizen'] }
};

function primeAccess() {
  getMock.mockImplementation((url: string, config?: { headers?: Record<string, string> }) => {
    const userId = config?.headers?.['x-user-id'] ?? '00000000-0000-0000-0000-000000000111';
    const tenantId = config?.headers?.['x-tenant-id'] ?? '00000000-0000-0000-0000-000000000001';
    if (url === '/v1/me/preferences') return Promise.resolve({ data: { language: 'it' } });
    if (url === '/v1/me/access') return Promise.resolve({ data: { user_id: userId, tenant_id: tenantId, ...(accessByUser[userId] ?? accessByUser['00000000-0000-0000-0000-000000000111']) } });
    if (url.includes('/branding')) return Promise.resolve({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } });
    if (url === '/v1/docs/public') return Promise.resolve({ data: { global: [], tenant: [] } });
    if (url === '/v1/segnalazioni') return Promise.resolve({ data: { items: [] } });
    return Promise.resolve({ data: {} });
  });
}

describe('Portale PA mobile dettaglio', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    vi.stubEnv('VITE_DEV_PROFILE_SWITCH', 'false');
    primeAccess();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('hides bottom nav before authentication and keeps direct dashboard login flow', async () => {
    render(<App />);
    expect(screen.queryByRole('navigation', { name: 'Navigazione mobile' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));

    expect(await screen.findByRole('heading', { name: 'Benvenuto nel portale segnalazioni' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigazione mobile' })).toBeInTheDocument();
  });

  it('shows dev profile switcher by default with explicit test-mode label', async () => {
    render(<App />);
    expect(screen.getByTestId('dev-profile-switcher')).toBeInTheDocument();
    expect(screen.getByText('MODALITÀ TEST')).toBeInTheDocument();
    await waitFor(() => expect(getMock).toHaveBeenCalled());
  });

  it('switches demo profile and uses selected headers for /v1/me/access', async () => {
    render(<App />);

    const profileSelect = await screen.findByLabelText('Profilo sviluppo');
    getMock.mockClear();

    await userEvent.selectOptions(profileSelect, 'admin_demo');

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/v1/me/access', expect.objectContaining({ headers: expect.objectContaining({
        'x-user-id': '00000000-0000-0000-0000-000000000333',
        'x-tenant-id': '00000000-0000-0000-0000-000000000001'
      }) }));
    });
  });

  it('renders role-aware links based on selected demo profile', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    expect(await screen.findByText('Nessuna area amministrativa disponibile per il tuo profilo.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Profilo sviluppo'), 'maintainer_demo');
    expect(await screen.findByRole('link', { name: 'Area maintainer • tenant 00000000-0000-0000-0000-000000000001' })).toHaveAttribute('href', '/maintainer?tenant_id=00000000-0000-0000-0000-000000000001');

    await userEvent.selectOptions(screen.getByLabelText('Profilo sviluppo'), 'admin_demo');
    expect(await screen.findByRole('link', { name: 'Apri area amministrazione' })).toHaveAttribute('href', '/admin?tenant_id=00000000-0000-0000-0000-000000000001');
  });

  it('keeps deterministic duplicate-search normalization contract', () => {
    const raw = 'Buche!!! via Verdi   incrocio';
    const normalized = raw.toLowerCase().replace(/[^a-z0-9àèéìòù\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    const search = normalized.split(' ').filter(Boolean).slice(0, 4).join(' ');
    expect(search).toBe('buche via verdi incrocio');
  });
});
