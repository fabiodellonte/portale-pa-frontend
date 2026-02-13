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

describe('Portale PA frontend extended scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.get.mockResolvedValue({ data: [] });
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

  it('shows public documentation for all users', async () => {
    seed();
    render(<App />);

    expect(await screen.findByText('Guida base')).toBeInTheDocument();
    expect(screen.getByText('Guida comune')).toBeInTheDocument();
  });

  it('submits bug report flow', async () => {
    seed();
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Segnala bug' }));
    await userEvent.type(await screen.findByLabelText('Titolo bug'), 'Errore login');
    await userEvent.type(screen.getByLabelText('Descrizione bug'), 'Dopo login compare pagina bianca in area personale.');
    await userEvent.click(screen.getByRole('button', { name: 'Invia bug report' }));

    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith('/v1/bug-reports', expect.any(Object), expect.any(Object)));
  });

  it('shows global docs admin section only for global admin', async () => {
    seed({ can_manage_branding: true, can_manage_roles: false });
    render(<App />);

    await screen.findByText('Branding comunale');
    expect(screen.queryByText('Documentazione globale amministrabile (global admin)')).not.toBeInTheDocument();
  });

  it('allows global admin to save global docs', async () => {
    seed({ can_manage_branding: true, can_manage_roles: true });
    render(<App />);

    await userEvent.type(await screen.findByLabelText('Slug globale'), 'faq');
    await userEvent.type(screen.getByLabelText('Titolo globale'), 'FAQ');
    await userEvent.type(screen.getByLabelText('Contenuto globale'), 'Contenuto istituzionale della faq');
    await userEvent.click(screen.getByRole('button', { name: 'Salva doc globale' }));

    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith('/v1/admin/docs/global', expect.objectContaining({ slug: 'faq' }), expect.any(Object)));
  });

  it('allows tenant admin/global admin to save tenant docs', async () => {
    seed({ can_manage_branding: true, can_manage_roles: false });
    render(<App />);

    await userEvent.type(await screen.findByLabelText('Slug tenant'), 'servizi');
    await userEvent.type(screen.getByLabelText('Titolo tenant'), 'Servizi comunali');
    await userEvent.type(screen.getByLabelText('Contenuto tenant'), 'Pagina servizi del comune.');
    await userEvent.click(screen.getByRole('button', { name: 'Salva doc tenant' }));

    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith(expect.stringContaining('/v1/admin/docs/tenant/'), expect.objectContaining({ slug: 'servizi' }), expect.any(Object)));
  });

  it('wires governance endpoints in admin section', async () => {
    seed({ can_manage_branding: true, can_manage_roles: false });
    render(<App />);

    await screen.findByText('Governance segnalazioni (amministrazione)');

    await userEvent.selectOptions(screen.getByLabelText('Nuovo stato segnalazione'), 'in_lavorazione');
    await userEvent.type(screen.getByLabelText('Messaggio transizione'), 'In carico all\'ufficio tecnico');
    await userEvent.click(screen.getByRole('button', { name: 'Aggiorna stato' }));

    await userEvent.type(screen.getByLabelText('ID operatore assegnazione'), '22222222-2222-2222-2222-222222222222');
    await userEvent.type(screen.getByLabelText('Messaggio assegnazione'), 'Presa in lavorazione');
    await userEvent.click(screen.getByRole('button', { name: 'Assegna' }));

    await userEvent.type(screen.getByLabelText('Messaggio pubblico segnalazione'), 'Intervento programmato per domani mattina.');
    await userEvent.click(screen.getByRole('button', { name: 'Pubblica risposta' }));

    await userEvent.click(screen.getByLabelText('Flag nascosta'));
    await userEvent.type(screen.getByLabelText('Nota moderazione'), 'Contenuto sensibile oscurato');
    await userEvent.click(screen.getByRole('button', { name: 'Salva flag' }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith('/v1/admin/segnalazioni/11111111-1111-1111-1111-111111111111/status-transition', expect.objectContaining({ status: 'in_lavorazione' }), expect.any(Object));
      expect(apiMocks.post).toHaveBeenCalledWith('/v1/admin/segnalazioni/11111111-1111-1111-1111-111111111111/assign', expect.objectContaining({ assigned_to: '22222222-2222-2222-2222-222222222222' }), expect.any(Object));
      expect(apiMocks.post).toHaveBeenCalledWith('/v1/admin/segnalazioni/11111111-1111-1111-1111-111111111111/public-response', expect.objectContaining({ message: 'Intervento programmato per domani mattina.' }), expect.any(Object));
      expect(apiMocks.post).toHaveBeenCalledWith('/v1/admin/segnalazioni/11111111-1111-1111-1111-111111111111/moderation-flags', expect.objectContaining({ flags: expect.objectContaining({ hidden: true }) }), expect.any(Object));
    });
  });
});
