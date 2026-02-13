import { render, screen, waitFor } from '@testing-library/react';
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

const accessByUser: Record<string, { portal_role: 'citizen' | 'maintainer' | 'admin'; portal_roles: Array<'citizen' | 'maintainer' | 'admin'> }> = {
  '00000000-0000-0000-0000-000000000111': { portal_role: 'citizen', portal_roles: ['citizen'] },
  '00000000-0000-0000-0000-000000000333': { portal_role: 'admin', portal_roles: ['admin', 'maintainer', 'citizen'] }
};

let demoModeState: 'on' | 'off' | 'unknown' = 'off';
let notificationsShouldFail = false;

function primeAccess() {
  getMock.mockImplementation((url: string, config?: { headers?: Record<string, string> }) => {
    const userId = config?.headers?.['x-user-id'] ?? '00000000-0000-0000-0000-000000000111';
    const tenantId = config?.headers?.['x-tenant-id'] ?? '00000000-0000-0000-0000-000000000001';

    if (url === '/v1/me/preferences') return Promise.resolve({ data: { language: 'it' } });
    if (url === '/v1/me/access') return Promise.resolve({ data: { user_id: userId, tenant_id: tenantId, ...(accessByUser[userId] ?? accessByUser['00000000-0000-0000-0000-000000000111']) } });
    if (url.includes('/branding')) return Promise.resolve({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } });
    if (url === '/v1/docs/public') return Promise.resolve({ data: { global: [{ slug: 'guida', title: 'Guida cittadino' }], tenant: [] } });
    if (url === '/v1/segnalazioni') return Promise.resolve({ data: { items: [{ id: 's1', titolo: 'Buca via Roma', stato: 'in_attesa', descrizione: 'Test', created_by: userId }] } });
    if (url === '/v1/segnalazioni/priorities') return Promise.resolve({ data: { items: [{ id: 's1', titolo: 'Buca via Roma', categoria: 'Viabilità', trend: '+12%', supporti: 3 }] } });
    if (url === '/v1/admin/demo-mode') return Promise.resolve({ data: { state: demoModeState, output: `status ${demoModeState}` } });
    if (url === '/v1/notifications') {
      if (notificationsShouldFail) return Promise.reject(new Error('down'));
      return Promise.resolve({ data: { items: [{ id: 'n1', kind: 'status', title: 'Aggiornamento segnalazione s1', body: 'Stato aggiornato', timestamp: new Date().toISOString(), unread: true }] } });
    }
    return Promise.resolve({ data: {} });
  });
}

describe('Portale PA UX refinements', () => {
  beforeEach(() => {
    localStorage.clear();
    getMock.mockReset();
    postMock.mockReset();
    demoModeState = 'off';
    notificationsShouldFail = false;

    postMock.mockImplementation((url: string, payload?: { mode?: 'on' | 'off' }) => {
      if (url === '/v1/admin/demo-mode') {
        demoModeState = payload?.mode ?? demoModeState;
        return Promise.resolve({ data: { state: demoModeState, status_output: `status ${demoModeState}` } });
      }
      return Promise.resolve({ data: {} });
    });

    primeAccess();
  });

  it('renders notifications from API feed', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.click(screen.getByLabelText('Notifiche'));

    expect(await screen.findByTestId('notifications-screen')).toBeInTheDocument();
    expect(screen.getByText('Aggiornamento segnalazione s1')).toBeInTheDocument();
    expect(screen.queryByText(/temporaneamente non disponibile/i)).not.toBeInTheDocument();
  });

  it('uses deterministic notifications fallback only when API is unavailable', async () => {
    notificationsShouldFail = true;
    primeAccess();

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.click(screen.getByLabelText('Notifiche'));

    expect(await screen.findByText(/Feed live temporaneamente non disponibile/i)).toBeInTheDocument();
    expect(screen.getByText(/Aggiornamento segnalazione/i)).toBeInTheDocument();
  });

  it('keeps profile IA sections and admin-only gating', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.click(screen.getByLabelText('Profilo'));

    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accessi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Modalità test' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Modalità Test DB' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Profilo sviluppo'), 'admin_demo');
    expect(await screen.findByRole('region', { name: 'Modalità Test DB' })).toBeInTheDocument();
  });

  it('opens and closes segnalazioni search modal and renders results list', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.keyboard('{Control>}k{/Control}');

    expect(await screen.findByText('Ricerca segnalazioni')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Titolo o descrizione (min 2 caratteri)'), 'buca');

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/v1/segnalazioni', expect.objectContaining({ params: expect.objectContaining({ search: 'buca' }) })));
    expect(await screen.findByRole('list', { name: 'Risultati ricerca segnalazioni' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(screen.queryByRole('dialog', { name: 'Ricerca segnalazioni' })).not.toBeInTheDocument();
  });
});
