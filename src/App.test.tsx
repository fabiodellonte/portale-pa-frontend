import { render, screen, waitFor, within } from '@testing-library/react';
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
let demoSeedShouldFail = false;

function primeAccess() {
  getMock.mockImplementation((url: string, config?: { headers?: Record<string, string> }) => {
    const userId = config?.headers?.['x-user-id'] ?? '00000000-0000-0000-0000-000000000111';
    const tenantId = config?.headers?.['x-tenant-id'] ?? '00000000-0000-0000-0000-000000000001';

    if (url === '/v1/me/preferences') return Promise.resolve({ data: { language: 'it' } });
    if (url === '/v1/me/access') return Promise.resolve({ data: { user_id: userId, tenant_id: tenantId, ...(accessByUser[userId] ?? accessByUser['00000000-0000-0000-0000-000000000111']) } });
    if (url === '/v1/me/tenant-label') return Promise.resolve({ data: { tenant_name: 'Pesaro' } });
    if (url.includes('/branding')) return Promise.resolve({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } });
    if (url === '/v1/docs/public') return Promise.resolve({ data: { global: [{ slug: 'guida', title: 'Guida cittadino' }], tenant: [{ slug: 'regole', title: 'Regole comunali' }] } });
    if (url === '/v1/segnalazioni') return Promise.resolve({ data: { items: [{ id: 's1', codice: 'SGN-001', titolo: 'Buca via Roma', stato: 'in_attesa', descrizione: 'Test', priorita: 'alta', severita: 'alta', address: 'Via Roma 24', created_by: userId }, { id: 's2', codice: 'SGN-002', titolo: 'Lampione spento', stato: 'presa_in_carico', descrizione: 'Test 2', priorita: 'media', severita: 'media', address: 'Piazza Municipio 1', created_by: userId }] } });
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
    demoSeedShouldFail = false;

    postMock.mockImplementation((url: string, payload?: { mode?: 'on' | 'off' }) => {
      if (url === '/v1/admin/demo-mode') {
        demoModeState = payload?.mode ?? demoModeState;
        return Promise.resolve({ data: { state: demoModeState, status_output: `status ${demoModeState}` } });
      }
      if (url === '/v1/admin/demo-seed/full') {
        if (demoSeedShouldFail) return Promise.reject(new Error('seed disabled'));
        return Promise.resolve({ data: { ok: true, message: 'Dataset demo completo caricato con successo.' } });
      }
      return Promise.resolve({ data: {} });
    });

    primeAccess();
  });

  it('shows tenant branding title and top icons with white outline style hooks', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));

    expect(await screen.findByRole('heading', { name: 'Città di Pesaro' })).toBeInTheDocument();
    expect(screen.getByLabelText('Documentazione pubblica')).toHaveClass('icon-btn');
    expect(screen.getByLabelText('Notifiche')).toHaveClass('icon-btn');
    expect(screen.getByLabelText('Profilo')).toHaveClass('icon-btn');
  });

  it('opens public docs panel from topbar icon', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.click(screen.getByLabelText('Documentazione pubblica'));

    expect(await screen.findByTestId('public-docs-screen')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Elenco documentazione pubblica' })).toBeInTheDocument();
    expect(screen.getByText('Guida cittadino')).toBeInTheDocument();
  });

  it('shows AI Insight card and opens AI assistant modal from home CTA', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));

    const insightCard = await screen.findByTestId('ai-insight-card');
    expect(insightCard).toBeInTheDocument();
    expect(within(insightCard).getByText(/Priorità alta/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Apri Assistente AI' }));
    expect(await screen.findByRole('dialog', { name: 'Assistente AI' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Prompt assistente AI'), 'priorità urgenti');
    expect(screen.getByText(/Ho analizzato "priorità urgenti"/i)).toBeInTheDocument();
  });

  it('keeps profile IA sections, admin-only gating, and full demo seed action feedback', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.click(screen.getByLabelText('Profilo'));

    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Modalità test' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carica dati demo completi' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Profilo sviluppo'), 'admin_demo');
    expect(await screen.findByRole('region', { name: 'Modalità Test DB' })).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Carica dati demo completi' });
    await userEvent.click(button);

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/v1/admin/demo-seed/full', {}, expect.any(Object)));
    expect(await screen.findByText(/Dataset demo completo caricato con successo/i)).toBeInTheDocument();
  });

  it('shows error feedback when full demo seed action fails', async () => {
    demoSeedShouldFail = true;
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.click(screen.getByLabelText('Profilo'));
    await userEvent.selectOptions(screen.getByLabelText('Profilo sviluppo'), 'admin_demo');

    await userEvent.click(await screen.findByRole('button', { name: 'Carica dati demo completi' }));
    expect(await screen.findByText(/Caricamento dati demo non riuscito/i)).toBeInTheDocument();
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
