import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn()
}));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: apiMocks.get,
      post: apiMocks.post,
      delete: apiMocks.del
    })
  }
}));

import App from './App';

describe('Portale PA frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders homepage metrics and ranking', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: { total_segnalazioni: 8, total_votes: 20, total_follows: 4, by_status: {} } })
      .mockResolvedValueOnce({ data: { items: [{ id: 's1', titolo: 'Lampione guasto', descrizione: 'x' }] } });

    render(<App />);

    expect(await screen.findByText('8')).toBeInTheDocument();
    expect(screen.getByText('Lampione guasto')).toBeInTheDocument();
  });

  it('applies realtime filters on segnalazioni list', async () => {
    window.history.pushState({}, '', '/segnalazioni');
    apiMocks.get.mockResolvedValue({ data: { items: [] } });

    render(<App />);

    await userEvent.type(screen.getByLabelText('Ricerca'), 'strada');

    await waitFor(() => {
      expect(apiMocks.get).toHaveBeenLastCalledWith('/v1/segnalazioni', expect.objectContaining({
        params: expect.objectContaining({ search: 'strada' })
      }));
    });
  });

  it('toggles vote from detail page', async () => {
    window.history.pushState({}, '', '/segnalazioni/abc-1');
    apiMocks.get.mockResolvedValue({ data: { id: 'abc-1', titolo: 'Titolo', descrizione: 'Desc', timeline: [], votes_count: 0, follows_count: 0 } });
    apiMocks.post.mockResolvedValue({ data: {} });

    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Vota/i }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith('/v1/segnalazioni/abc-1/vote-toggle', expect.any(Object));
    });
  });

  it('submits wizard payload at step 2', async () => {
    window.history.pushState({}, '', '/segnalazioni/nuova');
    apiMocks.post.mockResolvedValue({ data: { id: 'new-id' } });

    render(<App />);

    await userEvent.type(screen.getByLabelText('Titolo'), 'Buche in strada');
    await userEvent.type(screen.getByLabelText('Descrizione'), 'Ci sono buche profonde in via Roma.');
    await userEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    await userEvent.click(screen.getByRole('button', { name: 'Invia segnalazione' }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith('/v1/segnalazioni/wizard', expect.objectContaining({ titolo: 'Buche in strada' }));
    });
  });
});
