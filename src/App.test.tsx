import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  del: vi.fn()
}));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: apiMocks.get,
      put: apiMocks.put,
      post: apiMocks.post,
      delete: apiMocks.del
    })
  }
}));

import App from './App';

describe('Portale PA mobile institutional UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.post.mockResolvedValue({ data: { ok: true } });
    apiMocks.put.mockResolvedValue({ data: { ok: true } });
  });

  function seed(access = { can_manage_branding: false, can_manage_roles: false }) {
    apiMocks.get
      .mockResolvedValueOnce({ data: { language: 'it' } })
      .mockResolvedValueOnce({ data: access })
      .mockResolvedValueOnce({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } })
      .mockResolvedValueOnce({ data: { global: [{ slug: 'g1', title: 'Guida base' }], tenant: [{ slug: 't1', title: 'Guida comune' }] } });

    if (access.can_manage_branding || access.can_manage_roles) {
      apiMocks.get.mockResolvedValueOnce({
        data: { items: [{ id: '11111111-1111-1111-1111-111111111111', titolo: 'Lampione guasto' }] }
      });
    }
  }

  it('renders SPID login entry and opens mobile home', async () => {
    seed();
    render(<App />);

    expect(screen.getByText('Accedi con identità digitale')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entra con SPID' }));

    expect(await screen.findByText('Benvenuto nel portale segnalazioni')).toBeInTheDocument();
    expect(screen.getByText('Guida base')).toBeInTheDocument();
  });

  it('shows wizard step 1 with AI duplicate insight and submits bug report', async () => {
    seed();
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Nuova' }));
    expect(await screen.findByText('Nuova segnalazione • Step 1 di 4')).toBeInTheDocument();
    expect(screen.getByText('Possibile segnalazione simile trovata')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Titolo segnalazione'), 'Buche via Verdi');
    await userEvent.type(screen.getByLabelText('Descrizione segnalazione'), 'Tratto pericoloso vicino all\'incrocio principale.');
    await userEvent.click(screen.getByRole('button', { name: 'Prosegui' }));

    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith('/v1/bug-reports', expect.any(Object), expect.any(Object)));
    expect(await screen.findByText('Dettaglio segnalazione')).toBeInTheDocument();
  });

  it('shows priorities and dettaglio key blocks', async () => {
    seed();
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Priorità' }));
    expect(await screen.findByText('Priorità del territorio')).toBeInTheDocument();
    expect(screen.getByLabelText('Categorie priorità')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Dettaglio' }));
    expect(await screen.findByLabelText('Timeline stato')).toBeInTheDocument();
    expect(screen.getByText('Mappa area intervento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Segui aggiornamenti' })).toBeInTheDocument();
  });
});
