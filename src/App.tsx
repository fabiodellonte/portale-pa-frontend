import { useEffect, useState } from 'react';
import axios from 'axios';

type Tenant = {
  id: string;
  name: string;
  codice_fiscale_ente?: string;
};

const resolvedApiBase = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:18080`;

const api = axios.create({
  baseURL: resolvedApiBase
});

export default function App() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [name, setName] = useState('Comune di Pesaro');

  const loadTenants = async () => {
    const res = await api.get('/v1/tenants');
    setTenants(res.data.items || []);
  };

  useEffect(() => {
    void loadTenants();
  }, []);

  const onCreate = async () => {
    await api.post('/v1/tenants', { name });
    setName('');
    await loadTenants();
  };

  const onDelete = async (id: string) => {
    await api.delete(`/v1/tenants/${id}`);
    await loadTenants();
  };

  return (
    <main className="container">
      <h1>Portale PA – Tenant bootstrap</h1>
      <p>Frontend TS che parla solo con API Service.</p>

      <section className="card">
        <h2>Nuovo tenant</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome ente" />
        <button onClick={onCreate}>Crea</button>
      </section>

      <section className="card">
        <h2>Tenant esistenti</h2>
        <ul>
          {tenants.map((t) => (
            <li key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>{t.name}</span>
              <button onClick={() => onDelete(t.id)}>Rimuovi</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
