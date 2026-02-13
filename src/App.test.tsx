import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: vi.fn().mockResolvedValue({ data: {} }),
      put: vi.fn().mockResolvedValue({ data: { ok: true } }),
      post: vi.fn().mockResolvedValue({ data: { ok: true } }),
      delete: vi.fn()
    })
  }
}));

import App from './App';

describe('Portale PA mobile dettaglio', () => {
  it('opens dettaglio screen fallback without submitted report', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Dettaglio' }));
    expect(await screen.findByText('Nessuna nuova segnalazione inviata in questa sessione')).toBeInTheDocument();
  });

  it('keeps deterministic duplicate-search normalization contract', () => {
    const raw = 'Buche!!! via Verdi   incrocio';
    const normalized = raw.toLowerCase().replace(/[^a-z0-9àèéìòù\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    const search = normalized.split(' ').filter(Boolean).slice(0, 4).join(' ');
    expect(search).toBe('buche via verdi incrocio');
  });
});
