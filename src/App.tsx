import { FormEvent, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

type Access = {
  user_id?: string;
  tenant_id?: string;
  roles?: string[];
  can_manage_branding?: boolean;
  can_manage_roles?: boolean;
};

type Branding = { logo_url?: string | null; primary_color: string; secondary_color: string };
type Doc = { id?: string; slug: string; title: string; content_md: string; is_published?: boolean; sort_order?: number };
type GovernanceItem = { id: string; titolo?: string };
type Segnalazione = {
  id?: string;
  codice?: string;
  titolo?: string;
  stato?: string;
  created_by?: string;
  reported_by?: string;
  user_id?: string;
  author_id?: string;
  votes_count?: number;
  supporti?: number;
  metadata?: Record<string, unknown>;
  updated_at?: string;
};
type PublicMetrics = {
  total_segnalazioni?: number;
  total_votes?: number;
  total_follows?: number;
  by_status?: Record<string, number>;
};

type Screen = 'login' | 'home' | 'wizard' | 'priorita' | 'dettaglio';

const resolvedApiBase = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:18080`;
const api = axios.create({ baseURL: resolvedApiBase });

const defaultTenant = '00000000-0000-0000-0000-000000000001';
const defaultUser = '00000000-0000-0000-0000-000000000111';

const prioritiesMock = [
  { titolo: 'Sicurezza attraversamento scuola', trend: '+12%', supporti: 189, categoria: 'Viabilità' },
  { titolo: 'Perdite idriche in quartiere nord', trend: '+7%', supporti: 121, categoria: 'Acqua' },
  { titolo: 'Barriere architettoniche marciapiede', trend: '+4%', supporti: 96, categoria: 'Accessibilità' }
];

function statoLabel(stato?: string) {
  if (!stato) return 'In lavorazione';
  return stato.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());
}

function supportiDaSegnalazione(item: Segnalazione) {
  if (typeof item.votes_count === 'number') return item.votes_count;
  if (typeof item.supporti === 'number') return item.supporti;
  const metadataVotes = item.metadata?.votes_count;
  return typeof metadataVotes === 'number' ? metadataVotes : 0;
}

function segnalazioneIsMine(item: Segnalazione, userId: string) {
  return item.created_by === userId || item.reported_by === userId || item.user_id === userId || item.author_id === userId;
}

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
  const [governanceItems, setGovernanceItems] = useState<GovernanceItem[]>([]);
  const [governanceStatus, setGovernanceStatus] = useState('in_lavorazione');
  const [governanceStatusMsg, setGovernanceStatusMsg] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignMsg, setAssignMsg] = useState('');
  const [publicResponse, setPublicResponse] = useState('');
  const [flagHidden, setFlagHidden] = useState(false);
  const [flagAbusive, setFlagAbusive] = useState(false);
  const [flagRequiresReview, setFlagRequiresReview] = useState(false);
  const [flagDuplicateOf, setFlagDuplicateOf] = useState('');
  const [moderationNote, setModerationNote] = useState('');
  const [activeScreen, setActiveScreen] = useState<Screen>('login');

  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState('');
  const [featuredItems, setFeaturedItems] = useState<Array<{ title: string; text: string; badge: string }>>([]);
  const [myReports, setMyReports] = useState<Array<{ id: string; titolo: string; stato: string; supporti: number }>>([]);
  const [metrics, setMetrics] = useState<PublicMetrics | null>(null);

  const headers = useMemo(() => ({ 'x-user-id': userId, 'x-tenant-id': tenantId }), [tenantId, userId]);

  useEffect(() => {
    void (async () => {
      try {
        const [prefRes, accessRes, brandingRes, docsRes] = await Promise.all([
          api.get('/v1/me/preferences', { headers }),
          api.get('/v1/me/access', { headers }),
          api
            .get(`/v1/tenants/${tenantId}/branding`, { headers })
            .catch(() => ({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } })),
          api.get('/v1/docs/public', { headers })
        ]);
        setLanguage(prefRes.data.language ?? 'it');
        const nextAccess = accessRes.data ?? {};
        setAccess(nextAccess);
        setUserId(nextAccess.user_id ?? userId);
        setTenantId(nextAccess.tenant_id ?? tenantId);
        setBranding(brandingRes.data);
        setPublicDocs(docsRes.data ?? { global: [], tenant: [] });
      } catch {
        setPublicDocs({ global: [], tenant: [] });
      }
    })();
  }, [headers, tenantId, userId]);

  useEffect(() => {
    void (async () => {
      setHomeLoading(true);
      setHomeError('');
      try {
        const [segnalazioniRes, metricsRes] = await Promise.all([
          api.get('/v1/segnalazioni', {
            headers,
            params: { tenant_id: tenantId, page: 1, page_size: 50, sort: 'updated_at.desc' }
          }),
          api.get('/v1/public/metrics', {
            headers,
            params: { tenant_id: tenantId }
          })
        ]);

        const allSegnalazioni = (segnalazioniRes.data?.items ?? []) as Segnalazione[];
        setFeaturedItems(
          allSegnalazioni.slice(0, 3).map((item) => ({
            title: item.titolo ?? 'Segnalazione',
            text: `Stato: ${statoLabel(item.stato)}${item.updated_at ? ` • Agg. ${new Date(item.updated_at).toLocaleDateString('it-IT')}` : ''}`,
            badge: statoLabel(item.stato)
          }))
        );

        setMyReports(
          allSegnalazioni
            .filter((item) => segnalazioneIsMine(item, userId))
            .slice(0, 5)
            .map((item) => ({
              id: item.codice ?? item.id ?? 'SGN',
              titolo: item.titolo ?? 'Segnalazione',
              stato: statoLabel(item.stato),
              supporti: supportiDaSegnalazione(item)
            }))
        );

        setMetrics(metricsRes.data ?? null);
      } catch {
        setHomeError('Al momento non è possibile caricare i dati aggiornati. Riprova più tardi.');
        setFeaturedItems([]);
        setMyReports([]);
        setMetrics(null);
      } finally {
        setHomeLoading(false);
      }
    })();
  }, [headers, tenantId, userId]);

  useEffect(() => {
    if (!(access?.can_manage_branding || access?.can_manage_roles)) return;
    void (async () => {
      const listRes = await api.get('/v1/segnalazioni', {
        headers,
        params: { tenant_id: tenantId, page: 1, page_size: 20, sort: 'updated_at.desc' }
      });
      setGovernanceItems(listRes.data?.items ?? []);
    })();
  }, [access?.can_manage_branding, access?.can_manage_roles, headers, tenantId]);

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
  const submitWizardStep = async (e: FormEvent) => {
    await sendBug(e);
    setActiveScreen('dettaglio');
  };
  const saveTenantDoc = async (e: FormEvent) => {
    e.preventDefault();
    await api.post(`/v1/admin/docs/tenant/${tenantId}`, { ...tenantDoc, is_published: true, sort_order: 0 }, { headers });
  };

  const firstGovernanceId = governanceItems[0]?.id;
  const updateStatus = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstGovernanceId) return;
    await api.post(
      `/v1/admin/segnalazioni/${firstGovernanceId}/status-transition`,
      { tenant_id: tenantId, status: governanceStatus, message: governanceStatusMsg || undefined },
      { headers }
    );
  };
  const assignOperator = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstGovernanceId) return;
    await api.post(
      `/v1/admin/segnalazioni/${firstGovernanceId}/assign`,
      { tenant_id: tenantId, assigned_to: assignedTo, message: assignMsg || undefined },
      { headers }
    );
  };
  const publishResponse = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstGovernanceId) return;
    await api.post(`/v1/admin/segnalazioni/${firstGovernanceId}/public-response`, { tenant_id: tenantId, message: publicResponse }, { headers });
  };
  const saveFlags = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstGovernanceId) return;
    await api.post(
      `/v1/admin/segnalazioni/${firstGovernanceId}/moderation-flags`,
      {
        tenant_id: tenantId,
        flags: {
          hidden: flagHidden,
          abusive: flagAbusive,
          requires_review: flagRequiresReview,
          duplicate_of: flagDuplicateOf || undefined,
          note: moderationNote || undefined
        }
      },
      { headers }
    );
  };

  return (
    <main className="mobile-shell">
      {activeScreen === 'login' && (
        <section className="screen card institutional-login">
          <p className="eyebrow">Portale Istituzionale Segnalazioni</p>
          <h1>Accedi con identità digitale</h1>
          <p className="muted">Servizio comunale per segnalazioni, priorità e aggiornamenti sul territorio.</p>
          <div className="spid-card">
            <strong>SPID / CIE</strong>
            <p>Autenticazione sicura per cittadini e operatori.</p>
            <button type="button" onClick={() => setActiveScreen('home')}>Entra con SPID</button>
          </div>
        </section>
      )}

      {activeScreen === 'home' && (
        <section className="screen home-screen">
          <header className="card welcome">
            <p className="eyebrow">Comune di riferimento</p>
            <h2>Benvenuto nel portale segnalazioni</h2>
            <p className="muted">Consulta aggiornamenti, crea nuove segnalazioni e monitora lo stato delle tue richieste.</p>
            <button type="button" className="primary" onClick={() => setActiveScreen('wizard')}>Crea segnalazione</button>
          </header>

          <article className="card">
            <h3>Metriche territoriali</h3>
            {homeLoading && <p className="muted">Caricamento metriche...</p>}
            {homeError && <p className="muted">{homeError}</p>}
            {!homeLoading && !homeError && (
              <ul className="plain-list">
                <li><strong>Segnalazioni totali</strong><small>{metrics?.total_segnalazioni ?? 0}</small></li>
                <li><strong>Supporti civici</strong><small>{metrics?.total_votes ?? 0}</small></li>
                <li><strong>Follow attivi</strong><small>{metrics?.total_follows ?? 0}</small></li>
              </ul>
            )}
          </article>

          <article className="card">
            <h3>In evidenza</h3>
            {homeLoading && <p className="muted">Caricamento segnalazioni in evidenza...</p>}
            {!homeLoading && !homeError && featuredItems.length === 0 && <p className="muted">Nessuna segnalazione in evidenza disponibile.</p>}
            <div className="horizontal-list" aria-label="Schede in evidenza">
              {featuredItems.map((item) => (
                <div key={item.title} className="feature-card">
                  <span>{item.badge}</span>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <h3>Le mie segnalazioni</h3>
            {homeLoading && <p className="muted">Caricamento delle tue segnalazioni...</p>}
            {!homeLoading && !homeError && myReports.length === 0 && <p className="muted">Non risultano segnalazioni create con il tuo profilo.</p>}
            <ul className="plain-list">
              {myReports.map((report) => (
                <li key={report.id}>
                  <div>
                    <strong>{report.titolo}</strong>
                    <p>{report.id} • {report.stato}</p>
                  </div>
                  <small>{report.supporti} supporti</small>
                </li>
              ))}
            </ul>
          </article>

          <article className="card">
            <h3>Documentazione pubblica</h3>
            <ul className="plain-list docs-list">
              {[...(publicDocs.global ?? []), ...(publicDocs.tenant ?? [])].map((doc) => (
                <li key={doc.slug}>{doc.title}</li>
              ))}
            </ul>
          </article>
        </section>
      )}

      {activeScreen === 'wizard' && (
        <section className="screen card">
          <form className="screen" onSubmit={submitWizardStep}>
            <p className="eyebrow">Nuova segnalazione • Step 1 di 4</p>
            <h2>Descrivi il problema</h2>
            <label>
              Titolo
              <input aria-label="Titolo segnalazione" value={bugTitle} onChange={(e) => setBugTitle(e.target.value)} placeholder="Es. Dissesto manto stradale" />
            </label>
            <label>
              Descrizione
              <textarea aria-label="Descrizione segnalazione" value={bugDescription} onChange={(e) => setBugDescription(e.target.value)} placeholder="Indica posizione, orari e impatto" />
            </label>

            <div className="ai-insight" aria-label="Suggerimento duplicati">
              <p className="eyebrow">Insight AI</p>
              <strong>Possibile segnalazione simile trovata</strong>
              <p>"Buche in via Verdi" (SGN-1245) a 350m. Valuta se supportare quella esistente per accelerare la priorità.</p>
              <button type="button" onClick={() => setActiveScreen('priorita')}>Vai al ranking priorità</button>
            </div>

            <div className="row-actions">
              <button type="button" onClick={() => setActiveScreen('home')}>Annulla</button>
              <button type="submit" className="primary">Prosegui</button>
            </div>
          </form>
        </section>
      )}

      {activeScreen === 'priorita' && (
        <section className="screen card">
          <p className="eyebrow">Classifica segnalazioni</p>
          <h2>Priorità del territorio</h2>
          <div className="chips" aria-label="Categorie priorità">
            <span>Viabilità</span><span>Illuminazione</span><span>Decoro</span><span>Accessibilità</span>
          </div>
          <ul className="plain-list">
            {prioritiesMock.map((p) => (
              <li key={p.titolo}>
                <div>
                  <strong>{p.titolo}</strong>
                  <p>{p.categoria} • Trend {p.trend}</p>
                </div>
                <button type="button">Supporta ({p.supporti})</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeScreen === 'dettaglio' && (
        <section className="screen detail-screen">
          <article className="card">
            <p className="eyebrow">Dettaglio segnalazione</p>
            <h2>SGN-1245 • Buche in via Verdi</h2>
            <ol className="timeline" aria-label="Timeline stato">
              <li><strong>Inviata</strong><span>12 feb, 08:24</span></li>
              <li><strong>Presa in carico</strong><span>12 feb, 14:05</span></li>
              <li><strong>In lavorazione</strong><span>13 feb, 09:40</span></li>
            </ol>
          </article>

          <article className="card">
            <h3>Descrizione</h3>
            <p>Avvallamenti diffusi sulla carreggiata in prossimità dell'incrocio con via Manzoni. Rischio per cicli e motocicli.</p>
          </article>

          <article className="card split">
            <div>
              <h3>Cittadini interessati</h3>
              <p>41 supporti • 9 commenti civici moderati</p>
            </div>
            <button type="button">Segui aggiornamenti</button>
          </article>

          <article className="card">
            <h3>Mappa area intervento</h3>
            <div className="map-placeholder">Mappa georeferenziata (placeholder pronta per API map)</div>
          </article>

          {(access?.can_manage_branding || access?.can_manage_roles) && (
            <details className="card admin-panel">
              <summary>Strumenti amministrativi (API wiring esistente)</summary>
              <form onSubmit={saveLanguage}><label>Lingua<select aria-label="Lingua" value={language} onChange={(e) => setLanguage(e.target.value as 'it' | 'en')}><option value="it">Italiano</option><option value="en">English</option></select></label><button type="submit">Salva lingua</button></form>
              <form onSubmit={saveBranding}><label>Colore primario<input aria-label="Colore primario" value={branding.primary_color} onChange={(e) => setBranding((b) => ({ ...b, primary_color: e.target.value }))} /></label><label>Colore secondario<input aria-label="Colore secondario" value={branding.secondary_color} onChange={(e) => setBranding((b) => ({ ...b, secondary_color: e.target.value }))} /></label><button type="submit">Salva branding</button></form>
              <form onSubmit={updateStatus}><label>Nuovo stato segnalazione<select aria-label="Nuovo stato segnalazione" value={governanceStatus} onChange={(e) => setGovernanceStatus(e.target.value)}><option value="in_attesa">in_attesa</option><option value="presa_in_carico">presa_in_carico</option><option value="in_lavorazione">in_lavorazione</option><option value="risolta">risolta</option><option value="chiusa">chiusa</option><option value="respinta">respinta</option></select></label><label>Messaggio transizione<input aria-label="Messaggio transizione" value={governanceStatusMsg} onChange={(e) => setGovernanceStatusMsg(e.target.value)} /></label><button type="submit">Aggiorna stato</button></form>
              <form onSubmit={assignOperator}><label>ID operatore assegnazione<input aria-label="ID operatore assegnazione" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} /></label><label>Messaggio assegnazione<input aria-label="Messaggio assegnazione" value={assignMsg} onChange={(e) => setAssignMsg(e.target.value)} /></label><button type="submit">Assegna</button></form>
              <form onSubmit={publishResponse}><label>Messaggio pubblico segnalazione<textarea aria-label="Messaggio pubblico segnalazione" value={publicResponse} onChange={(e) => setPublicResponse(e.target.value)} /></label><button type="submit">Pubblica risposta</button></form>
              <form onSubmit={saveFlags}><label><input aria-label="Flag nascosta" type="checkbox" checked={flagHidden} onChange={(e) => setFlagHidden(e.target.checked)} />Flag nascosta</label><label><input aria-label="Flag abusiva" type="checkbox" checked={flagAbusive} onChange={(e) => setFlagAbusive(e.target.checked)} />Flag abusiva</label><label><input aria-label="Flag richiede revisione" type="checkbox" checked={flagRequiresReview} onChange={(e) => setFlagRequiresReview(e.target.checked)} />Flag richiede revisione</label><label>Flag duplicata di<input aria-label="Flag duplicata di" value={flagDuplicateOf} onChange={(e) => setFlagDuplicateOf(e.target.value)} /></label><label>Nota moderazione<input aria-label="Nota moderazione" value={moderationNote} onChange={(e) => setModerationNote(e.target.value)} /></label><button type="submit">Salva flag</button></form>
              {access?.can_manage_roles && (<><form onSubmit={saveGlobalDoc}><label>Slug globale<input aria-label="Slug globale" value={globalDoc.slug} onChange={(e) => setGlobalDoc((d) => ({ ...d, slug: e.target.value }))} /></label><label>Titolo globale<input aria-label="Titolo globale" value={globalDoc.title} onChange={(e) => setGlobalDoc((d) => ({ ...d, title: e.target.value }))} /></label><label>Contenuto globale<textarea aria-label="Contenuto globale" value={globalDoc.content_md} onChange={(e) => setGlobalDoc((d) => ({ ...d, content_md: e.target.value }))} /></label><button type="submit">Salva doc globale</button></form></>)}
              {(access?.can_manage_branding || access?.can_manage_roles) && (<form onSubmit={saveTenantDoc}><label>Slug tenant<input aria-label="Slug tenant" value={tenantDoc.slug} onChange={(e) => setTenantDoc((d) => ({ ...d, slug: e.target.value }))} /></label><label>Titolo tenant<input aria-label="Titolo tenant" value={tenantDoc.title} onChange={(e) => setTenantDoc((d) => ({ ...d, title: e.target.value }))} /></label><label>Contenuto tenant<textarea aria-label="Contenuto tenant" value={tenantDoc.content_md} onChange={(e) => setTenantDoc((d) => ({ ...d, content_md: e.target.value }))} /></label><button type="submit">Salva doc tenant</button></form>)}
            </details>
          )}
        </section>
      )}

      <nav className="bottom-nav" aria-label="Navigazione mobile">
        <button type="button" onClick={() => setActiveScreen('home')} className={activeScreen === 'home' ? 'active' : ''}>Home</button>
        <button type="button" onClick={() => setActiveScreen('wizard')} className={activeScreen === 'wizard' ? 'active' : ''}>Nuova</button>
        <button type="button" onClick={() => setActiveScreen('priorita')} className={activeScreen === 'priorita' ? 'active' : ''}>Priorità</button>
        <button type="button" onClick={() => setActiveScreen('dettaglio')} className={activeScreen === 'dettaglio' ? 'active' : ''}>Dettaglio</button>
      </nav>
    </main>
  );
}
