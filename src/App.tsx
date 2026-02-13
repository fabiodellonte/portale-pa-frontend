import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';

type Access = {
  user_id: string;
  tenant_id: string;
  roles: string[];
  can_manage_branding: boolean;
  can_manage_roles: boolean;
};

type Branding = { logo_url?: string | null; primary_color: string; secondary_color: string };
type Doc = { id?: string; slug: string; title: string; content_md: string; is_published?: boolean; sort_order?: number };

const resolvedApiBase = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:18080`;
const api = axios.create({ baseURL: resolvedApiBase });

const defaultTenant = '00000000-0000-0000-0000-000000000001';
const defaultUser = '00000000-0000-0000-0000-000000000111';

export default function App() {
  const [tenantId, setTenantId] = useState(defaultTenant);
  const [userId, setUserId] = useState(defaultUser);
  const [language, setLanguage] = useState<'it' | 'en'>('it');
  const [access, setAccess] = useState<Access | null>(null);
  const [branding, setBranding] = useState<Branding>({ primary_color: '#0055A4', secondary_color: '#FFFFFF' });
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [publicDocs, setPublicDocs] = useState<{ global: Doc[]; tenant: Doc[] }>({ global: [], tenant: [] });
  const [globalDoc, setGlobalDoc] = useState<Doc>({ slug: '', title: '', content_md: '' });
  const [tenantDoc, setTenantDoc] = useState<Doc>({ slug: '', title: '', content_md: '' });

  const headers = { 'x-user-id': userId, 'x-tenant-id': tenantId };

  useEffect(() => {
    void (async () => {
      const [prefRes, accessRes, brandingRes, docsRes] = await Promise.all([
        api.get('/v1/me/preferences', { headers }),
        api.get('/v1/me/access', { headers }),
        api.get(`/v1/tenants/${tenantId}/branding`, { headers }).catch(() => ({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } })),
        api.get('/v1/docs/public', { headers })
      ]);
      setLanguage(prefRes.data.language ?? 'it');
      setAccess(accessRes.data);
      setBranding(brandingRes.data);
      setPublicDocs(docsRes.data);
    })();
  }, [tenantId, userId]);

  const saveLanguage = async (e: FormEvent) => {
    e.preventDefault();
    await api.put('/v1/me/preferences/language', { language }, { headers });
  };

  const saveBranding = async (e: FormEvent) => {
    e.preventDefault();
    await api.put(`/v1/tenants/${tenantId}/branding`, branding, { headers });
  };

  const sendBug = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/v1/bug-reports', { title: bugTitle, description: bugDescription, page_url: window.location.href }, { headers });
    setBugTitle('');
    setBugDescription('');
  };

  const saveGlobalDoc = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/v1/admin/docs/global', { ...globalDoc, is_published: true, sort_order: 0 }, { headers });
  };

  const saveTenantDoc = async (e: FormEvent) => {
    e.preventDefault();
    await api.post(`/v1/admin/docs/tenant/${tenantId}`, { ...tenantDoc, is_published: true, sort_order: 0 }, { headers });
  };

  return (
    <main className="shell">
      <header className="topbar">
        <h1>Portale PA</h1>
        <p>Fase estesa: segnalazione bug e documentazione</p>
        <div className="identity-grid">
          <label>Tenant ID<input value={tenantId} onChange={(e) => setTenantId(e.target.value)} /></label>
          <label>User ID<input value={userId} onChange={(e) => setUserId(e.target.value)} /></label>
        </div>
      </header>

      <section className="page card">
        <h2>Impostazioni utente</h2>
        <form onSubmit={saveLanguage}>
          <label>Lingua
            <select aria-label="Lingua" value={language} onChange={(e) => setLanguage(e.target.value as 'it' | 'en')}>
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </label>
          <button type="submit">Salva lingua</button>
        </form>
      </section>

      <section className="page card">
        <h2>Documentazione portale (consultabile da tutti)</h2>
        <ul>
          {publicDocs.global.map((d) => <li key={`g-${d.slug}`}>{d.title}</li>)}
          {publicDocs.tenant.map((d) => <li key={`t-${d.slug}`}>{d.title}</li>)}
        </ul>
      </section>

      <section className="page card">
        <h2>Segnala un bug</h2>
        <form onSubmit={sendBug}>
          <label>Titolo bug<input aria-label="Titolo bug" value={bugTitle} onChange={(e) => setBugTitle(e.target.value)} /></label>
          <label>Descrizione bug<textarea aria-label="Descrizione bug" value={bugDescription} onChange={(e) => setBugDescription(e.target.value)} /></label>
          <button type="submit">Invia bug report</button>
        </form>
      </section>

      {access?.can_manage_branding && (
        <section className="page card">
          <h2>Branding comunale</h2>
          <form onSubmit={saveBranding}>
            <label>Colore primario<input aria-label="Colore primario" value={branding.primary_color} onChange={(e) => setBranding((b) => ({ ...b, primary_color: e.target.value }))} /></label>
            <label>Colore secondario<input aria-label="Colore secondario" value={branding.secondary_color} onChange={(e) => setBranding((b) => ({ ...b, secondary_color: e.target.value }))} /></label>
            <button type="submit">Salva branding</button>
          </form>
        </section>
      )}

      {access?.can_manage_roles && (
        <section className="page card">
          <h2>Documentazione globale amministrabile (global admin)</h2>
          <form onSubmit={saveGlobalDoc}>
            <label>Slug globale<input aria-label="Slug globale" value={globalDoc.slug} onChange={(e) => setGlobalDoc((d) => ({ ...d, slug: e.target.value }))} /></label>
            <label>Titolo globale<input aria-label="Titolo globale" value={globalDoc.title} onChange={(e) => setGlobalDoc((d) => ({ ...d, title: e.target.value }))} /></label>
            <label>Contenuto globale<textarea aria-label="Contenuto globale" value={globalDoc.content_md} onChange={(e) => setGlobalDoc((d) => ({ ...d, content_md: e.target.value }))} /></label>
            <button type="submit">Salva doc globale</button>
          </form>
        </section>
      )}

      {(access?.can_manage_branding || access?.can_manage_roles) && (
        <section className="page card">
          <h2>Documentazione del comune (tenant admin)</h2>
          <form onSubmit={saveTenantDoc}>
            <label>Slug tenant<input aria-label="Slug tenant" value={tenantDoc.slug} onChange={(e) => setTenantDoc((d) => ({ ...d, slug: e.target.value }))} /></label>
            <label>Titolo tenant<input aria-label="Titolo tenant" value={tenantDoc.title} onChange={(e) => setTenantDoc((d) => ({ ...d, title: e.target.value }))} /></label>
            <label>Contenuto tenant<textarea aria-label="Contenuto tenant" value={tenantDoc.content_md} onChange={(e) => setTenantDoc((d) => ({ ...d, content_md: e.target.value }))} /></label>
            <button type="submit">Salva doc tenant</button>
          </form>
        </section>
      )}
    </main>
  );
}
