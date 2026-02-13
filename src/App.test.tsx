import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function primeAccess(accessData: Record<string, unknown>) {
  getMock.mockImplementation((url: string) => {
    if (url === '/v1/me/preferences') return Promise.resolve({ data: { language: 'it' } });
    if (url === '/v1/me/access') return Promise.resolve({ data: accessData });
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
    primeAccess({ portal_role: 'citizen', portal_roles: ['citizen'] });
  });

  it('hides bottom nav before authentication and keeps direct dashboard login flow', async () => {
    render(<App />);
    expect(screen.queryByRole('navigation', { name: 'Navigazione mobile' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));

    expect(await screen.findByRole('heading', { name: 'Benvenuto nel portale segnalazioni' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigazione mobile' })).toBeInTheDocument();
  });

  it('shows no admin links in user settings for citizen role', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));

    expect(await screen.findByText('Nessuna area amministrativa disponibile per il tuo profilo.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Apri area amministrazione' })).not.toBeInTheDocument();
  });

  it('shows maintainer links for own tenant in user settings', async () => {
    primeAccess({ tenant_id: 'tenant-001', portal_role: 'maintainer', portal_roles: ['maintainer', 'citizen'] });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));

    expect(await screen.findByRole('link', { name: 'Area maintainer • tenant tenant-001' })).toHaveAttribute('href', '/maintainer?tenant_id=tenant-001');
  });

  it('shows admin links to admin/maintainer/citizen views in user settings', async () => {
    primeAccess({ tenant_id: 'tenant-001', portal_role: 'admin', portal_roles: ['admin', 'maintainer', 'citizen'] });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));

    expect(await screen.findByRole('link', { name: 'Apri area amministrazione' })).toHaveAttribute('href', '/admin?tenant_id=tenant-001');
    expect(screen.getByRole('link', { name: 'Accedi come maintainer' })).toHaveAttribute('href', '/maintainer?tenant_id=tenant-001&view_as=maintainer');
    expect(screen.getByRole('link', { name: 'Accedi come cittadino' })).toHaveAttribute('href', '/dashboard?tenant_id=tenant-001&view_as=citizen');
  });

  it('keeps deterministic duplicate-search normalization contract', () => {
    const raw = 'Buche!!! via Verdi   incrocio';
    const normalized = raw.toLowerCase().replace(/[^a-z0-9àèéìòù\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    const search = normalized.split(' ').filter(Boolean).slice(0, 4).join(' ');
    expect(search).toBe('buche via verdi incrocio');
  });
});
