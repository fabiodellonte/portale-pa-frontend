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

let demoModeState: 'on' | 'off' | 'unknown' = 'off';

function primeAccess() {
  getMock.mockImplementation((url: string, config?: { headers?: Record<string, string> }) => {
    const userId = config?.headers?.['x-user-id'] ?? '00000000-0000-0000-0000-000000000111';
    const tenantId = config?.headers?.['x-tenant-id'] ?? '00000000-0000-0000-0000-000000000001';
    if (url === '/v1/me/preferences') return Promise.resolve({ data: { language: 'it' } });
    if (url === '/v1/me/access') return Promise.resolve({ data: { user_id: userId, tenant_id: tenantId, ...(accessByUser[userId] ?? accessByUser['00000000-0000-0000-0000-000000000111']) } });
    if (url.includes('/branding')) return Promise.resolve({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } });
    if (url === '/v1/docs/public') return Promise.resolve({ data: { global: [], tenant: [] } });
    if (url === '/v1/segnalazioni') return Promise.resolve({ data: { items: [{ id: 's1', titolo: 'Buca via Roma', stato: 'in_attesa', descrizione: 'Test', created_by: userId }] } });
    if (url === '/v1/segnalazioni/priorities') return Promise.resolve({ data: { items: [{ id: 's1', titolo: 'Buca via Roma', categoria: 'Viabilità', trend: '+12%', supporti: 3 }] } });
    if (url === '/v1/segnalazioni/s1') return Promise.resolve({ data: { id: 's1', codice: 'SGN-1', titolo: 'Buca via Roma', descrizione: 'Dettaglio reale da DB', timeline: [] } });
    if (url === '/v1/admin/demo-mode') return Promise.resolve({ data: { state: demoModeState, output: `status ${demoModeState}` } });
    if (url === '/v1/segnalazioni/assisted-tags') return Promise.resolve({ data: { items: [{ id: 't1', slug: 'viabilita', label: 'Viabilità' }, { id: 't2', slug: 'illuminazione', label: 'Illuminazione' }] } });
    if (url === '/v1/segnalazioni/assisted-addresses') return Promise.resolve({ data: { items: [{ id: 'a1', address: 'Via Roma 24', reference_code: 'VRM24', lat: 41.9, lng: 12.5 }] } });
    return Promise.resolve({ data: {} });
  });
}

describe('Portale PA mobile dettaglio', () => {
  beforeEach(() => {
    localStorage.clear();
    getMock.mockReset();
    postMock.mockReset();
    demoModeState = 'off';
    postMock.mockImplementation((url: string, payload?: { mode?: 'on' | 'off' }) => {
      if (url === '/v1/admin/demo-mode') {
        demoModeState = payload?.mode ?? demoModeState;
        return Promise.resolve({ data: { state: demoModeState, status_output: `status ${demoModeState}` } });
      }
      if (url === '/v1/segnalazioni/s1/vote-toggle') {
        return Promise.resolve({ data: { votes_count: 4 } });
      }
      if (url === '/v1/segnalazioni/assisted-addresses/validate') {
        return Promise.resolve({ data: { validated: true, source: 'tenant_address_catalog', catalog_id: 'a1', normalized_address: 'Via Roma 24', reference_code: 'VRM24', lat: 41.9, lng: 12.5, confidence: 1 } });
      }
      if (url === '/v1/segnalazioni/wizard') {
        return Promise.resolve({ data: { id: 's9', codice: 'SGN-9', titolo: 'Nuova segnalazione' } });
      }
      return Promise.resolve({ data: {} });
    });
    vi.stubEnv('VITE_DEV_PROFILE_SWITCH', 'false');
    primeAccess();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('restores theme from localStorage and toggles persistently', async () => {
    localStorage.setItem('portale-pa-theme-mode', 'dark');
    render(<App />);

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(screen.getAllByRole('button', { name: 'Tema: Scuro' }).length).toBeGreaterThan(0);
    expect(document.documentElement.style.getPropertyValue('--gradient-wizard')).toContain('#16253a');
    expect(document.documentElement.style.getPropertyValue('--shadow-nav')).toContain('0.45');

    await userEvent.click(screen.getAllByRole('button', { name: 'Tema: Scuro' })[0]);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
    expect(localStorage.getItem('portale-pa-theme-mode')).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--gradient-wizard')).toContain('#fcfdff');
  });

  it('hides bottom nav before authentication and keeps direct dashboard login flow', async () => {
    render(<App />);
    expect(screen.queryByRole('navigation', { name: 'Navigazione mobile' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));

    expect(await screen.findByRole('heading', { name: 'Benvenuto nel portale segnalazioni' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigazione mobile' })).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-home')).toHaveAttribute('aria-current', 'page');
  });

  it('keeps bottom nav active state aligned while moving across core screens', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await screen.findByRole('heading', { name: 'Benvenuto nel portale segnalazioni' });

    await userEvent.click(screen.getByTestId('bottom-nav-priorita'));
    expect(await screen.findByTestId('priority-shell')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-priorita')).toHaveAttribute('aria-current', 'page');

    await userEvent.click(screen.getByTestId('bottom-nav-wizard'));
    expect(await screen.findByTestId('wizard-shell')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-wizard')).toHaveAttribute('aria-current', 'page');
  });

  it('smoke renders Login and Home with new visual shell', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Accedi con identità digitale' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    expect(await screen.findByRole('heading', { name: 'Benvenuto nel portale segnalazioni' })).toBeInTheDocument();
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

  it('shows and controls Modalità Test DB only for admin users', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    expect(screen.queryByRole('region', { name: 'Modalità Test DB' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Profilo sviluppo'), 'admin_demo');

    const demoPanel = await screen.findByRole('region', { name: 'Modalità Test DB' });
    expect(demoPanel).toBeInTheDocument();
    expect(demoPanel).toHaveTextContent('Stato corrente: OFF');

    await userEvent.click(screen.getByRole('button', { name: 'ON' }));
    expect(await screen.findByText('Modalità Test DB impostata su ON.')).toBeInTheDocument();
    expect(demoPanel).toHaveTextContent('Stato corrente: ON');
  });

  it('loads priorities and detail from API endpoints (no local mock cards)', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.click(screen.getByRole('button', { name: 'Priorità' }));

    expect(await screen.findByText('Buca via Roma')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Supporta (3)' }));
    expect(postMock).toHaveBeenCalledWith('/v1/segnalazioni/s1/vote-toggle', expect.anything(), expect.anything());

    await userEvent.click(screen.getByRole('button', { name: 'Dettaglio' }));
    expect(await screen.findByText(/Dettaglio reale da DB/)).toBeInTheDocument();
  });

  it('uses assisted tags + address validation and blocks submit until verified', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crea segnalazione' }));

    await userEvent.type(screen.getByLabelText('Titolo segnalazione'), 'Buche via Roma');
    await userEvent.type(screen.getByLabelText('Descrizione segnalazione'), 'Descrizione abbastanza lunga per completare il wizard.');
    await userEvent.click(screen.getByRole('button', { name: 'Prosegui' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continua' }));

    await userEvent.type(screen.getByLabelText('Indirizzo segnalazione'), 'Via Roma 24');
    await userEvent.click(await screen.findByRole('button', { name: /Via Roma 24 • VRM24/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Viabilità' }));

    const submitBefore = screen.getByRole('button', { name: 'Invia segnalazione' });
    expect(submitBefore).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Valida indirizzo' }));
    expect(await screen.findByText('Indirizzo verificato')).toBeInTheDocument();

    const submitAfter = screen.getByRole('button', { name: 'Invia segnalazione' });
    expect(submitAfter).toBeEnabled();
    await userEvent.click(submitAfter);

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/v1/segnalazioni/wizard', expect.objectContaining({
      tag_slugs: ['viabilita'],
      address_validation: expect.objectContaining({ validated: true, reference_code: 'VRM24' })
    }), expect.anything()));
  });

  it('renders wizard with step progress and responsive shell classes', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crea segnalazione' }));

    expect(screen.getByTestId('wizard-shell')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 1 di 3')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Titolo segnalazione'), 'Buche via Roma');
    await userEvent.type(screen.getByLabelText('Descrizione segnalazione'), 'Descrizione abbastanza lunga per completare il wizard.');
    await userEvent.click(screen.getByRole('button', { name: 'Prosegui' }));

    expect(await screen.findByLabelText('Step 2 di 3')).toBeInTheDocument();
  });

  it('renders dedicated priority and detail responsive shells', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.click(screen.getByRole('button', { name: 'Priorità' }));
    expect(await screen.findByTestId('priority-shell')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Dettaglio' }));
    expect(await screen.findByTestId('detail-screen')).toBeInTheDocument();
  });

  it('keeps deterministic duplicate-search normalization contract', () => {
    const raw = 'Buche!!! via Verdi   incrocio';
    const normalized = raw.toLowerCase().replace(/[^a-z0-9àèéìòù\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    const search = normalized.split(' ').filter(Boolean).slice(0, 4).join(' ');
    expect(search).toBe('buche via verdi incrocio');
  });
});
