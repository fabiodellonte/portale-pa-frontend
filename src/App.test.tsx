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
    if (url === '/v1/notifications') return Promise.resolve({ data: { items: [] } });
    return Promise.resolve({ data: {} });
  });
}

describe('Portale PA mobile layout refresh', () => {
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
      return Promise.resolve({ data: {} });
    });

    primeAccess();
  });

  it('renders top bar icons on home after login', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByLabelText('Profilo')).toBeInTheDocument();
    expect(screen.getByLabelText('Notifiche')).toBeInTheDocument();
    expect(screen.getByLabelText('Cerca')).toBeInTheDocument();
  });

  it('moves settings and test controls to profile screen', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    expect(screen.queryByRole('region', { name: 'Modalità test' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Profilo'));
    expect(await screen.findByTestId('profile-screen')).toBeInTheDocument();
    expect(screen.getByTestId('dev-profile-switcher')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tema:/ })).toBeInTheDocument();
    expect(screen.getByText('MODALITÀ TEST')).toBeInTheDocument();
  });

  it('opens notifications screen from top bar and renders structured cards', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.click(screen.getByLabelText('Notifiche'));

    expect(await screen.findByTestId('notifications-screen')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Lista notifiche' })).toBeInTheDocument();
    expect(screen.getByText(/Aggiornamento segnalazione/i)).toBeInTheDocument();
  });

  it('keeps admin-only demo panel visibility as regression check', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    await userEvent.click(screen.getByLabelText('Profilo'));

    expect(screen.queryByRole('region', { name: 'Modalità Test DB' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Profilo sviluppo'), 'admin_demo');
    const panel = await screen.findByRole('region', { name: 'Modalità Test DB' });
    expect(panel).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'ON' }));
    await waitFor(() => expect(screen.getByText('Modalità Test DB impostata su ON.')).toBeInTheDocument());
  });

  it('highlights new bottom navigation entries consistently', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));
    expect(screen.getByTestId('bottom-nav-home')).toHaveAttribute('aria-current', 'page');

    await userEvent.click(screen.getByTestId('bottom-nav-notifiche'));
    expect(await screen.findByTestId('notifications-screen')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-notifiche')).toHaveAttribute('aria-current', 'page');
  });
});
