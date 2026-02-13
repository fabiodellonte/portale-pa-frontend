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
type GovernanceItem = { id: string; titolo?: string };

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
  const [bugOpen, setBugOpen] = useState(false);
  const [publicDocs, setPublicDocs] = useState<{ global: Doc[]; tenant: Doc[] }>({ global: [], tenant: [] });
  const [globalDoc, setGlobalDoc] = useState<Doc>({ slug: '', title: '', content_md: '' });
  const [tenantDoc, setTenantDoc] = useState<Doc>({ slug: '', title: '', content_md: '' });
  const [governanceItems, setGovernanceItems] = useState<GovernanceItem[]>([]);
  const [governanceStatus, setGovernanceStatus] = useState('in_lavorazione');
  const [governanceStatusMsg, setGovernanceStatusMsg] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignMsg, setAssignMsg] = useState('');
  const [publicResponse, setPublicResponse] = useState('');
  const [flagHidden, setFlagHidden] = useState(false);
  const [moderationNote, setModerationNote] = useState('');

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
      setPublicDocs(docsRes.data?.global && docsRes.data?.tenant ? docsRes.data : { global: [], tenant: [] });
    })();
  }, [tenantId, userId]);

  useEffect(() => {
    if (!(access?.can_manage_branding || access?.can_manage_roles)) {
      setGovernanceItems([]);
      return;
    }

    void (async () => {
      try {
        const listRes = await api.get('/v1/segnalazioni', { headers, params: { tenant_id: tenantId, page: 1, page_size: 1 } });
        setGovernanceItems(listRes?.data?.items ?? []);
      } catch {
        setGovernanceItems([]);
      }
    })();
  }, [access?.can_manage_branding, access?.can_manage_roles, tenantId, userId]);

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
    setBugOpen(false);
  };

  const saveGlobalDoc = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/v1/admin/docs/global', { ...globalDoc, is_published: true, sort_order: 0 }, { headers });
  };

  const saveTenantDoc = async (e: FormEvent) => {
    e.preventDefault();
    await api.post(`/v1/admin/docs/tenant/${tenantId}`, { ...tenantDoc, is_published: true, sort_order: 0 }, { headers });
  };

  const firstGovernanceId = governanceItems[0]?.id;

  const updateStatus = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstGovernanceId) return;
    await api.post(`/v1/admin/segnalazioni/${firstGovernanceId}/status-transition`, { tenant_id: tenantId, status: governanceStatus, message: governanceStatusMsg }, { headers });
  };

  const assignOperator = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstGovernanceId) return;
    await api.post(`/v1/admin/segnalazioni/${firstGovernanceId}/assign`, { tenant_id: tenantId, assigned_to: assignedTo, message: assignMsg }, { headers });
  };

  const publishResponse = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstGovernanceId) return;
    await api.post(`/v1/admin/segnalazioni/${firstGovernanceId}/public-response`, { tenant_id: tenantId, message: publicResponse }, { headers });
  };

  const saveFlags = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstGovernanceId) return;
    await api.post(`/v1/admin/segnalazioni/${firstGovernanceId}/moderation-flags`, { tenant_id: tenantId, flags: { hidden: flagHidden, note: moderationNote } }, { headers });
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
        <h2>Supporto</h2>
        <button type="button" onClick={() => setBugOpen((v) => !v)}>Segnala bug</button>
        {bugOpen && (
          <form onSubmit={sendBug}>
            <label>Titolo bug<input aria-label="Titolo bug" value={bugTitle} onChange={(e) => setBugTitle(e.target.value)} /></label>
            <label>Descrizione bug<textarea aria-label="Descrizione bug" value={bugDescription} onChange={(e) => setBugDescription(e.target.value)} /></label>
            <button type="submit">Invia bug report</button>
          </form>
        )}
      </section>

      {(access?.can_manage_branding || access?.can_manage_roles) && (
        <section className="page card">
          <h2>Governance segnalazioni (amministrazione)</h2>
          <form onSubmit={updateStatus}>
            <label>Nuovo stato segnalazione
              <select aria-label="Nuovo stato segnalazione" value={governanceStatus} onChange={(e) => setGovernanceStatus(e.target.value)}>
                <option value="presa_in_carico">presa_in_carico</option>
                <option value="in_lavorazione">in_lavorazione</option>
                <option value="risolta">risolta</option>
              </select>
            </label>
            <label>Messaggio transizione<input aria-label="Messaggio transizione" value={governanceStatusMsg} onChange={(e) => setGovernanceStatusMsg(e.target.value)} /></label>
            <button type="submit">Aggiorna stato</button>
          </form>
          <form onSubmit={assignOperator}>
            <label>ID operatore assegnazione<input aria-label="ID operatore assegnazione" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} /></label>
            <label>Messaggio assegnazione<input aria-label="Messaggio assegnazione" value={assignMsg} onChange={(e) => setAssignMsg(e.target.value)} /></label>
            <button type="submit">Assegna</button>
          </form>
          <form onSubmit={publishResponse}>
            <label>Messaggio pubblico segnalazione<textarea aria-label="Messaggio pubblico segnalazione" value={publicResponse} onChange={(e) => setPublicResponse(e.target.value)} /></label>
            <button type="submit">Pubblica risposta</button>
          </form>
          <form onSubmit={saveFlags}>
            <label>
              <input aria-label="Flag nascosta" type="checkbox" checked={flagHidden} onChange={(e) => setFlagHidden(e.target.checked)} />
              Flag nascosta
            </label>
            <label>Nota moderazione<input aria-label="Nota moderazione" value={moderationNote} onChange={(e) => setModerationNote(e.target.value)} /></label>
            <button type="submit">Salva flag</button>
          </form>
        </section>
      )}

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
