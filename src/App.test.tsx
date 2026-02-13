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
  });

  function seed(access = { can_manage_branding: false, can_manage_roles: false }) {
    apiMocks.get
      .mockResolvedValueOnce({ data: { language: 'it' } })
      .mockResolvedValueOnce({ data: access })
      .mockResolvedValueOnce({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } })
      .mockResolvedValueOnce({ data: { global: [{ slug: 'g1', title: 'Guida base' }], tenant: [{ slug: 't1', title: 'Guida comune' }] } });
  }

  it('shows public documentation for all users', async () => {
    seed();
    render(<App />);

    expect(await screen.findByText('Guida base')).toBeInTheDocument();
    expect(screen.getByText('Guida comune')).toBeInTheDocument();
  });

  it('submits bug report flow', async () => {
    seed();
    apiMocks.post.mockResolvedValue({ data: { id: 'b1', notified_admins: 2 } });
    render(<App />);

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
    apiMocks.post.mockResolvedValue({ data: { id: 'g2' } });
    render(<App />);

    await userEvent.type(await screen.findByLabelText('Slug globale'), 'faq');
    await userEvent.type(screen.getByLabelText('Titolo globale'), 'FAQ');
    await userEvent.type(screen.getByLabelText('Contenuto globale'), 'Contenuto istituzionale della faq');
    await userEvent.click(screen.getByRole('button', { name: 'Salva doc globale' }));

    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith('/v1/admin/docs/global', expect.objectContaining({ slug: 'faq' }), expect.any(Object)));
  });

  it('allows tenant admin/global admin to save tenant docs', async () => {
    seed({ can_manage_branding: true, can_manage_roles: false });
    apiMocks.post.mockResolvedValue({ data: { id: 't2' } });
    render(<App />);

    await userEvent.type(await screen.findByLabelText('Slug tenant'), 'servizi');
    await userEvent.type(screen.getByLabelText('Titolo tenant'), 'Servizi comunali');
    await userEvent.type(screen.getByLabelText('Contenuto tenant'), 'Pagina servizi del comune.');
    await userEvent.click(screen.getByRole('button', { name: 'Salva doc tenant' }));

    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith(expect.stringContaining('/v1/admin/docs/tenant/'), expect.objectContaining({ slug: 'servizi' }), expect.any(Object)));
  });
});
