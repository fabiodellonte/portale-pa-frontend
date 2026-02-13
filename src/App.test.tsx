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

describe('Portale PA frontend phase 4', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves language selection', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: { language: 'it' } })
      .mockResolvedValueOnce({ data: { can_manage_branding: false, can_manage_roles: false } })
      .mockResolvedValueOnce({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } });

    render(<App />);

    await userEvent.selectOptions(await screen.findByLabelText('Lingua'), 'en');
    await userEvent.click(screen.getByRole('button', { name: 'Salva lingua' }));

    await waitFor(() => {
      expect(apiMocks.put).toHaveBeenCalledWith('/v1/me/preferences/language', { language: 'en' }, expect.any(Object));
    });
  });

  it('shows branding form only for tenant admin and saves', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: { language: 'it' } })
      .mockResolvedValueOnce({ data: { can_manage_branding: true, can_manage_roles: false } })
      .mockResolvedValueOnce({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } });

    render(<App />);

    const primary = await screen.findByLabelText('Colore primario');
    await userEvent.clear(primary);
    await userEvent.type(primary, '#123456');
    await userEvent.click(screen.getByRole('button', { name: 'Salva branding' }));

    await waitFor(() => {
      expect(apiMocks.put).toHaveBeenCalledWith(expect.stringContaining('/branding'), expect.objectContaining({ primary_color: '#123456' }), expect.any(Object));
    });
  });

  it('hides role management for non-global admin', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: { language: 'it' } })
      .mockResolvedValueOnce({ data: { can_manage_branding: true, can_manage_roles: false } })
      .mockResolvedValueOnce({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } });

    render(<App />);

    expect(await screen.findByText('Amministrazione comunale - Branding')).toBeInTheDocument();
    expect(screen.queryByText('Global admin - Gestione accessi multi-tenant')).not.toBeInTheDocument();
  });

  it('shows role management for global admin and assigns role', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: { language: 'it' } })
      .mockResolvedValueOnce({ data: { can_manage_branding: true, can_manage_roles: true } })
      .mockResolvedValueOnce({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } });

    render(<App />);

    await userEvent.type(await screen.findByLabelText('User ID da promuovere'), '1386f06c-8d0c-4a99-a157-d3576447add2');
    await userEvent.click(screen.getByRole('button', { name: 'Assegna ruolo tenant_admin' }));

    await waitFor(() => {
      expect(apiMocks.put).toHaveBeenCalledWith(expect.stringContaining('/v1/admin/roles/'), expect.objectContaining({ role_code: 'tenant_admin' }), expect.any(Object));
    });
  });
});
