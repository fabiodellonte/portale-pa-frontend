import { FormEvent, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

type Tenant = { id: string; name: string; codice_fiscale_ente?: string };
type Metrics = {
  total_segnalazioni: number;
  total_votes: number;
  total_follows: number;
  by_status: Record<string, number>;
};
type Segnalazione = {
  id: string;
  codice?: string;
  titolo: string;
  descrizione: string;
  stato?: string;
  created_at?: string;
  updated_at?: string;
  category_id?: string;
  votes_count?: number;
  follows_count?: number;
};
type SegnalazioneDetail = Segnalazione & {
  timeline: Array<{ id: string; event_type?: string; message?: string; created_at?: string }>;
};

type Route = { page: 'home' | 'list' | 'detail' | 'wizard' | 'tenants'; id?: string };

const resolvedApiBase = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:18080`;
const api = axios.create({ baseURL: resolvedApiBase });

const defaultTenant = '00000000-0000-0000-0000-000000000001';
const defaultUser = '00000000-0000-0000-0000-000000000111';

function parseRoute(pathname: string): Route {
  if (pathname.startsWith('/segnalazioni/nuova')) return { page: 'wizard' };
  if (pathname.startsWith('/segnalazioni/')) return { page: 'detail', id: pathname.split('/')[2] };
  if (pathname.startsWith('/segnalazioni')) return { page: 'list' };
  if (pathname.startsWith('/tenant-admin')) return { page: 'tenants' };
  return { page: 'home' };
}

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('it-IT');
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute(window.location.pathname));
  const [tenantId, setTenantId] = useState(defaultTenant);
  const [userId, setUserId] = useState(defaultUser);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <h1>Portale PA</h1>
        <nav>
          <button onClick={() => navigate('/')}>Home</button>
          <button onClick={() => navigate('/segnalazioni')}>Segnalazioni</button>
          <button onClick={() => navigate('/segnalazioni/nuova')}>Nuova segnalazione</button>
          <button onClick={() => navigate('/tenant-admin')}>Tenant admin</button>
        </nav>
        <div className="identity-grid">
          <label>
            Tenant ID
            <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
          </label>
          <label>
            User ID
            <input value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
        </div>
      </header>

      {route.page === 'home' && <HomePage tenantId={tenantId} />}
      {route.page === 'list' && <SegnalazioniListPage tenantId={tenantId} />}
      {route.page === 'detail' && route.id && <SegnalazioneDetailPage id={route.id} tenantId={tenantId} userId={userId} />}
      {route.page === 'wizard' && <WizardPage tenantId={tenantId} userId={userId} />}
      {route.page === 'tenants' && <TenantsAdminPage />}
    </main>
  );
}

function HomePage({ tenantId }: { tenantId: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [ranking, setRanking] = useState<Segnalazione[]>([]);

  useEffect(() => {
    void api.get('/v1/public/metrics', { params: { tenant_id: tenantId } }).then((r) => setMetrics(r.data));
    void api
      .get('/v1/segnalazioni', { params: { tenant_id: tenantId, page: 1, page_size: 3, sort: 'votes.desc' } })
      .then((r) => setRanking(r.data.items ?? []));
  }, [tenantId]);

  return (
    <section className="page">
      <article className="hero card">
        <h2>Segnalazioni civiche digitali</h2>
        <p>Consulta lo stato delle segnalazioni pubbliche e partecipa al miglioramento del territorio.</p>
        <button onClick={() => navigate('/segnalazioni/nuova')}>Invia una segnalazione</button>
      </article>

      <section className="card metrics-grid">
        <h3>Indicatori in tempo reale</h3>
        <div className="kpis">
          <div><strong>{metrics?.total_segnalazioni ?? 0}</strong><span>Totale segnalazioni</span></div>
          <div><strong>{metrics?.total_votes ?? 0}</strong><span>Voti cittadini</span></div>
          <div><strong>{metrics?.total_follows ?? 0}</strong><span>Follower aggiornamenti</span></div>
        </div>
      </section>

      <section className="card">
        <h3>Classifica rapida (placeholder API)</h3>
        <ul>
          {ranking.map((item) => (
            <li key={item.id}>
              <button className="link" onClick={() => navigate(`/segnalazioni/${item.id}`)}>{item.titolo}</button>
            </li>
          ))}
          {ranking.length === 0 && <li>Nessuna segnalazione disponibile.</li>}
        </ul>
      </section>
    </section>
  );
}

function SegnalazioniListPage({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<Segnalazione[]>([]);
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at.desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      void api
        .get('/v1/segnalazioni', {
          params: {
            tenant_id: tenantId,
            status: status || undefined,
            category_id: categoryId || undefined,
            search: search.length >= 2 ? search : undefined,
            sort,
            page,
            page_size: 6
          }
        })
        .then((r) => setItems(r.data.items ?? []));
    }, 250);
    return () => clearTimeout(timer);
  }, [tenantId, status, categoryId, search, sort, page]);

  const categories = useMemo(() => Array.from(new Set(items.map((s) => s.category_id).filter(Boolean))) as string[], [items]);

  return (
    <section className="page card">
      <h2>Elenco segnalazioni</h2>
      <div className="filters-grid">
        <input aria-label="Ricerca" placeholder="Ricerca per titolo o descrizione" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select aria-label="Stato" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tutti gli stati</option>
          <option value="in_attesa">In attesa</option>
          <option value="in_lavorazione">In lavorazione</option>
          <option value="risolta">Risolta</option>
        </select>
        <select aria-label="Categoria" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
          <option value="">Tutte le categorie</option>
          {categories.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <select aria-label="Ordinamento" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="created_at.desc">Più recenti</option>
          <option value="created_at.asc">Meno recenti</option>
          <option value="updated_at.desc">Aggiornate di recente</option>
        </select>
      </div>

      <ul className="list">
        {items.map((item) => (
          <li key={item.id} className="list-item">
            <h3>{item.titolo}</h3>
            <p>{item.descrizione}</p>
            <small>Stato: {item.stato ?? 'n.d.'} · Aggiornata: {fmtDate(item.updated_at)}</small>
            <button onClick={() => navigate(`/segnalazioni/${item.id}`)}>Apri dettaglio</button>
          </li>
        ))}
      </ul>

      <footer className="pager">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Precedente</button>
        <span>Pagina {page}</span>
        <button onClick={() => setPage((p) => p + 1)} disabled={items.length < 6}>Successiva</button>
      </footer>
    </section>
  );
}

function SegnalazioneDetailPage({ id, tenantId, userId }: { id: string; tenantId: string; userId: string }) {
  const [item, setItem] = useState<SegnalazioneDetail | null>(null);

  const load = () => api.get(`/v1/segnalazioni/${id}`).then((r) => setItem(r.data));
  useEffect(() => { void load(); }, [id]);

  const toggleVote = async () => {
    await api.post(`/v1/segnalazioni/${id}/vote-toggle`, { tenant_id: tenantId, user_id: userId });
    await load();
  };
  const toggleFollow = async () => {
    await api.post(`/v1/segnalazioni/${id}/follow-toggle`, { tenant_id: tenantId, user_id: userId });
    await load();
  };

  if (!item) return <section className="page card">Caricamento…</section>;

  return (
    <section className="page card">
      <h2>{item.titolo}</h2>
      <p>{item.descrizione}</p>
      <p><strong>Stato:</strong> {item.stato ?? 'n.d.'}</p>
      <div className="actions">
        <button onClick={toggleVote}>Vota ({item.votes_count ?? 0})</button>
        <button onClick={toggleFollow}>Segui ({item.follows_count ?? 0})</button>
      </div>
      <h3>Timeline</h3>
      <ul>
        {item.timeline.map((ev) => (
          <li key={ev.id}>{fmtDate(ev.created_at)} · {ev.message || ev.event_type}</li>
        ))}
      </ul>
    </section>
  );
}

function WizardPage({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [step, setStep] = useState(1);
  const [titolo, setTitolo] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [address, setAddress] = useState('');
  const [tags, setTags] = useState('');
  const [createdId, setCreatedId] = useState('');

  const canNext = step === 1 ? titolo.length >= 3 && descrizione.length >= 10 : true;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      tenant_id: tenantId,
      user_id: userId,
      titolo,
      descrizione,
      category_id: categoryId || undefined,
      address: address || undefined,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined
    };
    const res = await api.post('/v1/segnalazioni/wizard', payload);
    setCreatedId(res.data.id);
    setStep(3);
  };

  return (
    <section className="page card">
      <h2>Nuova segnalazione guidata</h2>
      <p>Passo {step} di 3</p>
      <form onSubmit={submit}>
        {step === 1 && (
          <div className="wizard-grid">
            <label>Titolo<input value={titolo} onChange={(e) => setTitolo(e.target.value)} /></label>
            <label>Descrizione<textarea value={descrizione} onChange={(e) => setDescrizione(e.target.value)} /></label>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-grid">
            <label>Categoria (UUID)<input value={categoryId} onChange={(e) => setCategoryId(e.target.value)} /></label>
            <label>Indirizzo<input value={address} onChange={(e) => setAddress(e.target.value)} /></label>
            <label>Tag (separati da virgola)<input value={tags} onChange={(e) => setTags(e.target.value)} /></label>
          </div>
        )}

        {step === 3 && (
          <div>
            {createdId ? <p>Segnalazione creata con ID: <strong>{createdId}</strong></p> : <p>Conferma inviata.</p>}
            <button type="button" onClick={() => navigate('/segnalazioni')}>Vai all'elenco</button>
          </div>
        )}

        <div className="wizard-actions">
          {step > 1 && step < 3 && <button type="button" onClick={() => setStep((s) => s - 1)}>Indietro</button>}
          {step < 2 && <button type="button" onClick={() => canNext && setStep(2)} disabled={!canNext}>Avanti</button>}
          {step === 2 && <button type="submit">Invia segnalazione</button>}
        </div>
      </form>
    </section>
  );
}

function TenantsAdminPage() {
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
    <section className="page card">
      <h2>Tenant bootstrap</h2>
      <p>Area amministrativa tecnica mantenuta per compatibilità.</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome ente" />
      <button onClick={onCreate}>Crea</button>
      <ul>
        {tenants.map((t) => (
          <li key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>{t.name}</span>
            <button onClick={() => onDelete(t.id)}>Rimuovi</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
