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

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders and loads tenants', async () => {
    apiMocks.get.mockResolvedValueOnce({ data: { items: [{ id: '1', name: 'Comune Test' }] } });

    render(<App />);

    expect(await screen.findByText('Comune Test')).toBeInTheDocument();
  });

  it('creates a tenant', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: { items: [] } })
      .mockResolvedValueOnce({ data: { items: [{ id: '2', name: 'Comune Nuovo' }] } });
    apiMocks.post.mockResolvedValueOnce({ data: {} });

    render(<App />);

    await userEvent.clear(screen.getByPlaceholderText('Nome ente'));
    await userEvent.type(screen.getByPlaceholderText('Nome ente'), 'Comune Nuovo');
    await userEvent.click(screen.getByRole('button', { name: 'Crea' }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith('/v1/tenants', { name: 'Comune Nuovo' });
    });
  });
});
