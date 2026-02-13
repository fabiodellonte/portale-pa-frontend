import { FormEvent, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

type PortalRole = 'admin' | 'maintainer' | 'citizen';
type Access = {
  user_id?: string;
  tenant_id?: string;
  tenant_ids?: string[];
  portal_role?: PortalRole;
  portal_roles?: PortalRole[];
  can_manage_branding?: boolean;
  can_manage_roles?: boolean;
};
type Branding = { primary_color: string; secondary_color: string; logo_url?: string | null };
type Doc = { slug: string; title: string };
type Segnalazione = {
  id?: string;
  codice?: string;
  titolo?: string;
  descrizione?: string;
  stato?: string;
  created_by?: string;
  reported_by?: string;
  user_id?: string;
  author_id?: string;
  votes_count?: number;
  supporti?: number;
  metadata?: Record<string, unknown>;
  updated_at?: string;
  timeline?: Array<{ id?: string; message?: string; event_type?: string; created_at?: string }>;
};

type PriorityItem = { id: string; titolo: string; categoria: string; trend: string; supporti: number };

type Screen = 'login' | 'home' | 'wizard' | 'priorita' | 'dettaglio';
type WizardStep = 1 | 2 | 3;
type DevProfileKey = 'citizen_demo' | 'maintainer_demo' | 'admin_demo';

type DevProfile = {
  key: DevProfileKey;
  label: string;
  userId: string;
  tenantId: string;
};

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:18080` });
const defaultTenant = '00000000-0000-0000-0000-000000000001';
const defaultUser = '00000000-0000-0000-0000-000000000111';
const devProfiles: DevProfile[] = [
  { key: 'citizen_demo', label: 'citizen_demo', userId: '00000000-0000-0000-0000-000000000111', tenantId: defaultTenant },
  { key: 'maintainer_demo', label: 'maintainer_demo', userId: '00000000-0000-0000-0000-000000000222', tenantId: defaultTenant },
  { key: 'admin_demo', label: 'admin_demo', userId: '00000000-0000-0000-0000-000000000333', tenantId: defaultTenant }
];

function statoLabel(stato?: string) {
  return stato ? stato.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase()) : 'In lavorazione';
}
function getSearchString(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9àèéìòù\s]/gi, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).join(' ');
}

export default function App() {
  const devProfileSwitchEnabled = true;
  const [tenantId, setTenantId] = useState(defaultTenant);
  const [userId, setUserId] = useState(defaultUser);
  const [selectedDevProfile, setSelectedDevProfile] = useState<DevProfileKey>('citizen_demo');
  const [access, setAccess] = useState<Access | null>(null);
  const [branding, setBranding] = useState<Branding>({ primary_color: '#0055A4', secondary_color: '#FFFFFF' });
  const [publicDocs, setPublicDocs] = useState<{ global: Doc[]; tenant: Doc[] }>({ global: [], tenant: [] });

  const [activeScreen, setActiveScreen] = useState<Screen>('login');
  const [featuredItems, setFeaturedItems] = useState<Array<{ title: string; text: string; badge: string }>>([]);
  const [myReports, setMyReports] = useState<Array<{ id: string; titolo: string; stato: string; supporti: number }>>([]);
  const [homeError, setHomeError] = useState('');

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [wizardTitle, setWizardTitle] = useState('');
  const [wizardDescription, setWizardDescription] = useState('');
  const [wizardAddress, setWizardAddress] = useState('');
  const [wizardTags, setWizardTags] = useState('');
  const [wizardDuplicateOf, setWizardDuplicateOf] = useState('');
  const [wizardError, setWizardError] = useState('');
  const [wizardLoading, setWizardLoading] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<'endpoint' | 'fallback' | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<Segnalazione[]>([]);

  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [detail, setDetail] = useState<Segnalazione | null>(null);

  const headers = useMemo(() => ({ 'x-user-id': userId, 'x-tenant-id': tenantId }), [tenantId, userId]);

  const userSettingsLinks = useMemo(() => {
    const roleSet = new Set(access?.portal_roles ?? (access?.portal_role ? [access.portal_role] : []));
    const currentTenant = access?.tenant_id ?? tenantId;
    const ownedTenants = Array.from(new Set([...(access?.tenant_ids ?? []), currentTenant].filter(Boolean)));

    if (roleSet.has('admin')) {
      return [
        { label: 'Apri area amministrazione', href: `/admin?tenant_id=${currentTenant}` },
        { label: 'Accedi come maintainer', href: `/maintainer?tenant_id=${currentTenant}&view_as=maintainer` },
        { label: 'Accedi come cittadino', href: `/dashboard?tenant_id=${currentTenant}&view_as=citizen` }
      ];
    }

    if (roleSet.has('maintainer')) {
      return ownedTenants.map((id) => ({ label: `Area maintainer • tenant ${id}`, href: `/maintainer?tenant_id=${id}` }));
    }

    return [] as Array<{ label: string; href: string }>;
  }, [access, tenantId]);

  useEffect(() => {
    void (async () => {
      try {
        const [pref, acc, brand, docs] = await Promise.all([
          api.get('/v1/me/preferences', { headers }),
          api.get('/v1/me/access', { headers }),
          api.get(`/v1/tenants/${tenantId}/branding`, { headers }).catch(() => ({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } })),
          api.get('/v1/docs/public', { headers })
        ]);
        const next = acc.data ?? {};
        setAccess(next);
        setBranding(brand.data);
        setPublicDocs(docs.data ?? { global: [], tenant: [] });
        void pref;
      } catch {
        setPublicDocs({ global: [], tenant: [] });
      }
    })();
  }, [headers, tenantId, userId]);

  useEffect(() => {
    void (async () => {
      try {
        const segnalazioniRes = await api.get('/v1/segnalazioni', { headers, params: { tenant_id: tenantId, page: 1, page_size: 50, sort: 'updated_at.desc' } });
        const all = (segnalazioniRes.data?.items ?? []) as Segnalazione[];
        setFeaturedItems(all.slice(0, 3).map((i) => ({ title: i.titolo ?? 'Segnalazione', text: `Stato: ${statoLabel(i.stato)}`, badge: statoLabel(i.stato) })));
        setMyReports(all.filter((i) => i.created_by === userId || i.reported_by === userId || i.user_id === userId || i.author_id === userId).map((i) => ({ id: i.id ?? i.codice ?? 'SGN', titolo: i.titolo ?? 'Segnalazione', stato: statoLabel(i.stato), supporti: i.votes_count ?? i.supporti ?? 0 })));
        setHomeError('');
      } catch {
        setHomeError('Al momento non è possibile caricare i dati aggiornati. Riprova più tardi.');
        setFeaturedItems([]);
        setMyReports([]);
      }
    })();
  }, [headers, tenantId, userId]);

  useEffect(() => {
    void (async () => {
      try {
        const prioritiesRes = await api.get('/v1/segnalazioni/priorities', { headers, params: { tenant_id: tenantId, limit: 10 } });
        setPriorityItems((prioritiesRes.data?.items ?? []) as PriorityItem[]);
      } catch {
        setPriorityItems([]);
      }
    })();
  }, [headers, tenantId]);

  useEffect(() => {
    if (activeScreen !== 'dettaglio' || detail?.id) return;
    void (async () => {
      try {
        const recent = await api.get('/v1/segnalazioni', { headers, params: { tenant_id: tenantId, page: 1, page_size: 1, sort: 'updated_at.desc' } });
        const first = (recent.data?.items ?? [])[0] as Segnalazione | undefined;
        if (!first?.id) return;
        const data = await api.get(`/v1/segnalazioni/${first.id}`, { headers });
        setDetail(data.data as Segnalazione);
      } catch {
        setDetail(null);
      }
    })();
  }, [activeScreen, detail?.id, headers, tenantId]);

  const openWizard = () => {
    setWizardStep(1); setWizardError(''); setWizardTitle(''); setWizardDescription(''); setWizardAddress(''); setWizardTags(''); setWizardDuplicateOf(''); setDuplicateCandidates([]); setDuplicateMode(null); setActiveScreen('wizard');
  };

  const onDevProfileChange = (profileKey: DevProfileKey) => {
    const profile = devProfiles.find((item) => item.key === profileKey);
    if (!profile) return;
    setSelectedDevProfile(profileKey);
    setUserId(profile.userId);
    setTenantId(profile.tenantId);
    setAccess(null);
    setDetail(null);
  };

  const checkDuplicates = async () => {
    const search = getSearchString(wizardTitle);
    try {
      const r = await api.get('/v1/segnalazioni/duplicates', { headers, params: { tenant_id: tenantId, titolo: wizardTitle } });
      setDuplicateCandidates((r.data?.items ?? []) as Segnalazione[]); setDuplicateMode('endpoint');
    } catch {
      const r = await api.get('/v1/segnalazioni', { headers, params: { tenant_id: tenantId, page: 1, page_size: 5, search, sort: 'updated_at.desc' } });
      setDuplicateCandidates((r.data?.items ?? []) as Segnalazione[]); setDuplicateMode('fallback');
    }
  };

  const wizardStep1 = async (e: FormEvent) => {
    e.preventDefault();
    if (wizardTitle.trim().length < 3) return setWizardError('Inserisci un titolo di almeno 3 caratteri.');
    if (wizardDescription.trim().length < 10) return setWizardError('Inserisci una descrizione di almeno 10 caratteri.');
    setWizardError(''); setWizardStep(2); await checkDuplicates();
  };

  const submitWizard = async (e: FormEvent) => {
    e.preventDefault();
    if (wizardAddress.trim().length < 4) return setWizardError('Indica un indirizzo o riferimento dell’area (almeno 4 caratteri).');
    setWizardLoading(true); setWizardError('');
    try {
      const create = await api.post('/v1/segnalazioni/wizard', {
        tenant_id: tenantId,
        user_id: userId,
        titolo: wizardTitle.trim(),
        descrizione: wizardDescription.trim(),
        address: wizardAddress.trim(),
        tags: wizardTags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10),
        metadata: { source: 'wizard_step4', duplicate_candidate_id: wizardDuplicateOf || undefined, duplicate_check_mode: duplicateMode ?? 'fallback_list' }
      }, { headers });
      const created = create.data as Segnalazione;
      if (created.id) {
        const d = await api.get(`/v1/segnalazioni/${created.id}`, { headers });
        setDetail(d.data as Segnalazione);
      } else {
        setDetail(created);
      }
      setActiveScreen('dettaglio');
    } catch {
      setWizardError('Invio non riuscito. Verifica i dati inseriti e riprova.');
    } finally { setWizardLoading(false); }
  };

  const toggleSupport = async (id: string) => {
    try {
      const res = await api.post(`/v1/segnalazioni/${id}/vote-toggle`, { tenant_id: tenantId, user_id: userId }, { headers });
      const nextCount = Number(res.data?.votes_count ?? 0);
      setPriorityItems((curr) => curr.map((item) => (item.id === id ? { ...item, supporti: nextCount } : item)));
    } catch {
      // no-op: keep previous value
    }
  };

  const priorityCategories = Array.from(new Set(priorityItems.map((p) => p.categoria))).slice(0, 6);

  return (
    <main className="mobile-shell">
      {devProfileSwitchEnabled && <section className="card dev-profile-switcher" data-testid="dev-profile-switcher"><div className="dev-profile-switcher__header"><p className="eyebrow">Dev profile switch</p><span className="test-mode-badge">MODALITÀ TEST</span></div><label>Profilo simulato<select aria-label="Profilo sviluppo" value={selectedDevProfile} onChange={(e) => onDevProfileChange(e.target.value as DevProfileKey)}>{devProfiles.map((profile) => <option key={profile.key} value={profile.key}>{profile.label}</option>)}</select></label><p className="muted">Header API effettivi: x-user-id {userId} • x-tenant-id {tenantId}</p></section>}
      {activeScreen === 'login' && <section className="screen card institutional-login"><p className="eyebrow">Portale Istituzionale Segnalazioni</p><h1>Accedi con identità digitale</h1><p className="muted">Servizio comunale per segnalazioni, priorità e aggiornamenti sul territorio.</p><div className="spid-card"><strong>SPID / CIE</strong><p>Autenticazione sicura per cittadini e operatori.</p><button type="button" onClick={() => setActiveScreen('home')}>Entra con SPID</button></div></section>}

      {activeScreen === 'home' && <section className="screen home-screen"><header className="card welcome"><p className="eyebrow">Comune di riferimento</p><h2>Benvenuto nel portale segnalazioni</h2><p className="muted">Consulta aggiornamenti, crea nuove segnalazioni e monitora lo stato delle tue richieste.</p><button type="button" className="primary" onClick={openWizard}>Crea segnalazione</button></header><article className="card"><h3>In evidenza</h3>{homeError && <p className="muted">{homeError}</p>}<div className="horizontal-list">{featuredItems.map((i) => <div key={i.title} className="feature-card"><span>{i.badge}</span><strong>{i.title}</strong><p>{i.text}</p></div>)}</div></article><article className="card"><h3>Le mie segnalazioni</h3><ul className="plain-list">{myReports.map((r) => <li key={r.id}><div><strong>{r.titolo}</strong><p>{r.id} • {r.stato}</p></div><small>{r.supporti} supporti</small></li>)}</ul></article><article className="card"><h3>Documentazione pubblica</h3><ul className="plain-list docs-list">{[...(publicDocs.global ?? []), ...(publicDocs.tenant ?? [])].map((d) => <li key={d.slug}>{d.title}</li>)}</ul></article><article className="card"><h3>Impostazioni utente</h3><p className="muted">Gestione profilo e accessi al portale.</p>{userSettingsLinks.length > 0 ? <ul className="plain-list docs-list settings-links">{userSettingsLinks.map((link) => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul> : <p className="muted">Nessuna area amministrativa disponibile per il tuo profilo.</p>}</article></section>}

      {activeScreen === 'wizard' && <section className="screen card">
        {wizardStep === 1 && <form className="screen" onSubmit={wizardStep1}><p className="eyebrow">Nuova segnalazione • Step 1 di 3</p><h2>Descrivi il problema</h2><label>Titolo<input aria-label="Titolo segnalazione" value={wizardTitle} onChange={(e) => setWizardTitle(e.target.value)} /></label><label>Descrizione<textarea aria-label="Descrizione segnalazione" value={wizardDescription} onChange={(e) => setWizardDescription(e.target.value)} /></label>{wizardError && <p className="error-text">{wizardError}</p>}<div className="row-actions"><button type="button" onClick={() => setActiveScreen('home')}>Annulla</button><button type="submit" className="primary">Prosegui</button></div></form>}
        {wizardStep === 2 && <div className="screen"><p className="eyebrow">Nuova segnalazione • Step 2 di 3</p><h2>Controllo possibili duplicati</h2><div className="ai-insight" aria-label="Suggerimento duplicati"><p className="eyebrow">Verifica automatica</p><strong>{duplicateCandidates.length > 0 ? 'Segnalazioni simili trovate' : 'Nessun duplicato rilevante trovato'}</strong><p>{duplicateMode === 'endpoint' ? 'Controllo effettuato con endpoint dedicato duplicati.' : 'Controllo effettuato tramite ricerca deterministica su elenco segnalazioni.'}</p></div><ul className="plain-list">{duplicateCandidates.map((d) => <li key={d.id ?? d.codice}><div><strong>{d.titolo ?? 'Segnalazione simile'}</strong><p>{d.codice ?? d.id} • {statoLabel(d.stato)}</p></div><button type="button" onClick={() => setWizardDuplicateOf(d.id ?? '')}>{wizardDuplicateOf === d.id ? 'Selezionata' : 'Segna come simile'}</button></li>)}</ul><div className="row-actions"><button type="button" onClick={() => setWizardStep(1)}>Indietro</button><button type="button" className="primary" onClick={() => setWizardStep(3)}>Continua</button></div></div>}
        {wizardStep === 3 && <form className="screen" onSubmit={submitWizard}><p className="eyebrow">Nuova segnalazione • Step 3 di 3</p><h2>Conferma e invia</h2><label>Indirizzo / riferimento area<input aria-label="Indirizzo segnalazione" value={wizardAddress} onChange={(e) => setWizardAddress(e.target.value)} /></label><label>Tag (separati da virgola)<input aria-label="Tag segnalazione" value={wizardTags} onChange={(e) => setWizardTags(e.target.value)} /></label>{wizardError && <p className="error-text">{wizardError}</p>}<div className="row-actions"><button type="button" onClick={() => setWizardStep(2)}>Indietro</button><button type="submit" className="primary" disabled={wizardLoading}>{wizardLoading ? 'Invio...' : 'Invia segnalazione'}</button></div></form>}
      </section>}

      {activeScreen === 'priorita' && <section className="screen card"><p className="eyebrow">Classifica segnalazioni</p><h2>Priorità del territorio</h2><div className="chips" aria-label="Categorie priorità">{priorityCategories.map((cat) => <span key={cat}>{cat}</span>)}</div><ul className="plain-list">{priorityItems.map((p) => <li key={p.id}><div><strong>{p.titolo}</strong><p>{p.categoria} • Trend {p.trend}</p></div><button type="button" onClick={() => toggleSupport(p.id)}>Supporta ({p.supporti})</button></li>)}</ul>{priorityItems.length === 0 && <p className="muted">Nessuna priorità disponibile al momento.</p>}</section>}

      {activeScreen === 'dettaglio' && <section className="screen detail-screen"><article className="card"><p className="eyebrow">Dettaglio segnalazione</p>{detail ? <><h2>{detail.codice ?? detail.id} • {detail.titolo ?? 'Segnalazione inviata'}</h2><p className="success-text">Segnalazione registrata con successo. Conserva il codice pubblico per il monitoraggio.</p>{detail.timeline && detail.timeline.length > 0 && <ol className="timeline" aria-label="Timeline stato">{detail.timeline.map((t, i) => <li key={t.id ?? i}><strong>{t.message ?? t.event_type ?? 'Aggiornamento'}</strong><span>{t.created_at ? new Date(t.created_at).toLocaleString('it-IT') : 'Ora non disponibile'}</span></li>)}</ol>}</> : <h2>Nessuna segnalazione disponibile per il dettaglio.</h2>}</article><article className="card"><h3>Descrizione</h3><p>{detail?.descrizione ?? 'Nessun contenuto disponibile.'}</p></article></section>}

      {activeScreen !== 'login' && <nav className="bottom-nav" aria-label="Navigazione mobile"><button type="button" onClick={() => setActiveScreen('home')} className={activeScreen === 'home' ? 'active' : ''}>Home</button><button type="button" onClick={openWizard} className={activeScreen === 'wizard' ? 'active' : ''}>Nuova</button><button type="button" onClick={() => setActiveScreen('priorita')} className={activeScreen === 'priorita' ? 'active' : ''}>Priorità</button><button type="button" onClick={() => setActiveScreen('dettaglio')} className={activeScreen === 'dettaglio' ? 'active' : ''}>Dettaglio</button></nav>}
    </main>
  );
}
