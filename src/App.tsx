import { FormEvent, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Badge } from './components/ui/Badge';
import { BottomNav } from './components/ui/BottomNav';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Chip } from './components/ui/Chip';
import { Input, TextArea } from './components/ui/Input';
import { THEME_STORAGE_KEY, ThemeMode, applyTheme, getInitialTheme } from './theme/tokens';

type PortalRole = 'admin' | 'maintainer' | 'citizen';
type Access = { user_id?: string; tenant_id?: string; tenant_ids?: string[]; portal_role?: PortalRole; portal_roles?: PortalRole[] };
type Branding = { primary_color: string; secondary_color: string; logo_url?: string | null };
type Doc = { slug: string; title: string };
type Segnalazione = {
  id?: string; codice?: string; titolo?: string; descrizione?: string; stato?: string;
  created_by?: string; reported_by?: string; user_id?: string; author_id?: string;
  votes_count?: number; supporti?: number; updated_at?: string;
  timeline?: Array<{ id?: string; message?: string; event_type?: string; created_at?: string }>;
};

type PriorityItem = { id: string; titolo: string; categoria: string; trend: string; supporti: number };
type DemoModeState = 'on' | 'off' | 'unknown';
type DemoSeedState = 'idle' | 'loading' | 'success' | 'error';
type AssistedTag = { id: string; slug: string; label: string };
type AssistedAddress = { id: string; address: string; reference_code: string; lat: number; lng: number };
type AddressValidation = {
  validated: boolean; source: 'tenant_address_catalog'; catalog_id: string; normalized_address: string;
  reference_code: string; lat: number; lng: number;
};

type NotificationKind = 'status' | 'update' | 'assignment';
type AppNotification = { id: string; kind: NotificationKind; title: string; body: string; timestamp: string; unread: boolean };
type NotificationLoadState = 'idle' | 'loading' | 'ready' | 'fallback' | 'error';

type Screen = 'login' | 'home' | 'wizard' | 'priorita' | 'dettaglio' | 'profilo' | 'notifiche' | 'docs';
type WizardStep = 1 | 2 | 3;
type DevProfileKey = 'citizen_demo' | 'maintainer_demo' | 'admin_demo';
type DevProfile = { key: DevProfileKey; label: string; userId: string; tenantId: string };

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

function TopbarIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="topbar-icon" focusable="false">
      <path d={path} />
    </svg>
  );
}

export default function App() {
  const devProfileSwitchEnabled = true;
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialTheme());
  const [tenantId, setTenantId] = useState(defaultTenant);
  const [userId, setUserId] = useState(defaultUser);
  const [selectedDevProfile, setSelectedDevProfile] = useState<DevProfileKey>('citizen_demo');
  const [access, setAccess] = useState<Access | null>(null);
  const [, setBranding] = useState<Branding>({ primary_color: '#0055A4', secondary_color: '#FFFFFF' });
  const [publicDocs, setPublicDocs] = useState<{ global: Doc[]; tenant: Doc[] }>({ global: [], tenant: [] });

  const [activeScreen, setActiveScreen] = useState<Screen>('login');
  const [featuredItems, setFeaturedItems] = useState<Array<{ title: string; text: string; badge: string }>>([]);
  const [myReports, setMyReports] = useState<Array<{ id: string; titolo: string; stato: string; supporti: number }>>([]);
  const [homeError, setHomeError] = useState('');

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [wizardTitle, setWizardTitle] = useState('');
  const [wizardDescription, setWizardDescription] = useState('');
  const [wizardAddress, setWizardAddress] = useState('');
  const [wizardAddressCatalogId, setWizardAddressCatalogId] = useState('');
  const [wizardAddressSuggestions, setWizardAddressSuggestions] = useState<AssistedAddress[]>([]);
  const [wizardAddressValidation, setWizardAddressValidation] = useState<AddressValidation | null>(null);
  const [wizardTagOptions, setWizardTagOptions] = useState<AssistedTag[]>([]);
  const [wizardTagFilter, setWizardTagFilter] = useState('');
  const [wizardSelectedTagSlugs, setWizardSelectedTagSlugs] = useState<string[]>([]);
  const [wizardDuplicateOf, setWizardDuplicateOf] = useState('');
  const [wizardError, setWizardError] = useState('');
  const [wizardLoading, setWizardLoading] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<'endpoint' | 'fallback' | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<Segnalazione[]>([]);

  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [detail, setDetail] = useState<Segnalazione | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsState, setNotificationsState] = useState<NotificationLoadState>('idle');
  const [notificationsMessage, setNotificationsMessage] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Segnalazione[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [demoModeState, setDemoModeState] = useState<DemoModeState>('unknown');
  const [demoModeOutput, setDemoModeOutput] = useState('');
  const [demoModeBusy, setDemoModeBusy] = useState(false);
  const [demoModeFeedback, setDemoModeFeedback] = useState('');
  const [tenantName, setTenantName] = useState('Ente');
  const [demoSeedState, setDemoSeedState] = useState<DemoSeedState>('idle');
  const [demoSeedFeedback, setDemoSeedFeedback] = useState('');

  const headers = useMemo(() => ({ 'x-user-id': userId, 'x-tenant-id': tenantId }), [tenantId, userId]);
  const isAdmin = (access?.portal_roles ?? []).includes('admin') || access?.portal_role === 'admin';

  useEffect(() => {
    applyTheme(themeMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

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
    if (roleSet.has('maintainer')) return ownedTenants.map((id) => ({ label: `Area maintainer • tenant ${id}`, href: `/maintainer?tenant_id=${id}` }));
    return [] as Array<{ label: string; href: string }>;
  }, [access, tenantId]);

  const unreadNotifications = notifications.filter((item) => item.unread).length;

  const screenTitle = useMemo(() => ({
    home: 'Home', wizard: 'Nuova segnalazione', priorita: 'Priorità', dettaglio: 'Dettaglio', profilo: 'Profilo', notifiche: 'Notifiche', docs: 'Documentazione pubblica'
  } as Record<Exclude<Screen, 'login'>, string>), []);

  useEffect(() => {
    void (async () => {
      try {
        const [, acc, brand, docs, tenantLabel] = await Promise.all([
          api.get('/v1/me/preferences', { headers }),
          api.get('/v1/me/access', { headers }),
          api.get(`/v1/tenants/${tenantId}/branding`, { headers }).catch(() => ({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } })),
          api.get('/v1/docs/public', { headers }),
          api.get('/v1/me/tenant-label', { headers }).catch(() => ({ data: { tenant_name: 'Ente' } }))
        ]);
        setAccess(acc.data ?? {});
        setBranding(brand.data);
        setPublicDocs(docs.data ?? { global: [], tenant: [] });
        setTenantName(String(tenantLabel.data?.tenant_name ?? 'Ente'));
      } catch {
        setPublicDocs({ global: [], tenant: [] });
        setTenantName('Ente');
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

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      try {
        const res = await api.get('/v1/admin/demo-mode', { headers });
        setDemoModeState((res.data?.state ?? 'unknown') as DemoModeState);
        setDemoModeOutput(String(res.data?.output ?? ''));
      } catch {
        setDemoModeState('unknown');
      }
    })();
  }, [headers, isAdmin]);

  useEffect(() => {
    if (activeScreen !== 'wizard') return;
    void (async () => {
      try {
        const tagsRes = await api.get('/v1/segnalazioni/assisted-tags', { headers, params: { tenant_id: tenantId, q: wizardTagFilter || undefined, limit: 30 } });
        setWizardTagOptions((tagsRes.data?.items ?? []) as AssistedTag[]);
      } catch {
        setWizardTagOptions([]);
      }
    })();
  }, [activeScreen, headers, tenantId, wizardTagFilter]);

  useEffect(() => {
    if (activeScreen !== 'wizard' || wizardStep !== 3 || wizardAddress.trim().length < 2) {
      if (wizardAddress.trim().length < 2) setWizardAddressSuggestions([]);
      return;
    }
    void (async () => {
      try {
        const addressRes = await api.get('/v1/segnalazioni/assisted-addresses', { headers, params: { tenant_id: tenantId, q: wizardAddress.trim(), limit: 5 } });
        setWizardAddressSuggestions((addressRes.data?.items ?? []) as AssistedAddress[]);
      } catch {
        setWizardAddressSuggestions([]);
      }
    })();
  }, [activeScreen, headers, tenantId, wizardAddress, wizardStep]);

  useEffect(() => {
    void (async () => {
      setNotificationsState('loading');
      setNotificationsMessage('');
      try {
        const res = await api.get('/v1/notifications', { headers, params: { tenant_id: tenantId, user_id: userId, page: 1, page_size: 25 } });
        const items = (res.data?.items ?? []) as AppNotification[];
        setNotifications(items);
        setNotificationsState('ready');
      } catch {
        const fallback: AppNotification[] = [
          ...myReports.slice(0, 3).map((report, idx) => ({ id: `status-${report.id}`, kind: 'status' as const, title: `Aggiornamento segnalazione ${report.id}`, body: `${report.titolo} • stato ${report.stato}`, timestamp: new Date(Date.now() - idx * 3600000).toISOString(), unread: idx < 2 })),
          ...priorityItems.slice(0, 2).map((item, idx) => ({ id: `assignment-${item.id}`, kind: 'assignment' as const, title: `Priorità territoriale: ${item.categoria}`, body: `${item.titolo} ora con ${item.supporti} supporti.`, timestamp: new Date(Date.now() - (idx + 3) * 3600000).toISOString(), unread: false }))
        ];
        setNotifications(fallback);
        setNotificationsState(fallback.length > 0 ? 'fallback' : 'error');
        setNotificationsMessage('Feed live temporaneamente non disponibile. Visualizzazione dati locali.');
      }
    })();
  }, [headers, myReports, priorityItems, tenantId, userId]);

  const onDevProfileChange = (profileKey: DevProfileKey) => {
    const profile = devProfiles.find((item) => item.key === profileKey);
    if (!profile) return;
    setSelectedDevProfile(profileKey);
    setUserId(profile.userId);
    setTenantId(profile.tenantId);
    setAccess(null);
    setDetail(null);
  };

  const openWizard = () => {
    setWizardStep(1); setWizardError(''); setWizardTitle(''); setWizardDescription(''); setWizardAddress(''); setWizardAddressCatalogId(''); setWizardAddressSuggestions([]); setWizardAddressValidation(null); setWizardTagFilter(''); setWizardSelectedTagSlugs([]); setWizardDuplicateOf(''); setDuplicateCandidates([]); setDuplicateMode(null); setActiveScreen('wizard');
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

  const validateWizardAddress = async () => {
    if (!wizardAddressCatalogId || wizardAddress.trim().length < 3) return setWizardError('Seleziona un indirizzo suggerito prima della validazione.');
    try {
      const res = await api.post('/v1/segnalazioni/assisted-addresses/validate', { tenant_id: tenantId, catalog_id: wizardAddressCatalogId, address: wizardAddress.trim() }, { headers });
      setWizardAddressValidation(res.data as AddressValidation);
      setWizardError('');
    } catch {
      setWizardAddressValidation(null);
      setWizardError('Validazione indirizzo non riuscita. Verifica il suggerimento selezionato.');
    }
  };

  const submitWizard = async (e: FormEvent) => {
    e.preventDefault();
    if (wizardAddress.trim().length < 4) return setWizardError('Indica un indirizzo o riferimento dell’area (almeno 4 caratteri).');
    if (!wizardAddressValidation?.validated) return setWizardError('Conferma prima la validazione dell’indirizzo.');
    setWizardLoading(true); setWizardError('');
    try {
      const create = await api.post('/v1/segnalazioni/wizard', { tenant_id: tenantId, user_id: userId, titolo: wizardTitle.trim(), descrizione: wizardDescription.trim(), address: wizardAddress.trim(), tag_slugs: wizardSelectedTagSlugs, address_validation: wizardAddressValidation, metadata: { source: 'wizard_step3_assisted', duplicate_candidate_id: wizardDuplicateOf || undefined, duplicate_check_mode: duplicateMode ?? 'fallback_list' } }, { headers });
      const created = create.data as Segnalazione;
      if (created.id) {
        const d = await api.get(`/v1/segnalazioni/${created.id}`, { headers });
        setDetail(d.data as Segnalazione);
      } else setDetail(created);
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
    } catch {}
  };

  const switchDemoMode = async (mode: 'on' | 'off') => {
    setDemoModeBusy(true);
    setDemoModeFeedback('');
    try {
      const res = await api.post('/v1/admin/demo-mode', { mode }, { headers });
      setDemoModeState((res.data?.state ?? 'unknown') as DemoModeState);
      setDemoModeOutput(String(res.data?.status_output ?? res.data?.output ?? ''));
      setDemoModeFeedback(`Modalità Test DB impostata su ${mode.toUpperCase()}.`);
    } catch {
      setDemoModeFeedback('Operazione non riuscita. Verifica flag backend e permessi admin.');
    } finally {
      setDemoModeBusy(false);
    }
  };

  const loadFullDemoData = async () => {
    setDemoSeedState('loading');
    setDemoSeedFeedback('Caricamento dataset demo completo in corso...');
    try {
      const res = await api.post('/v1/admin/demo-seed/full', {}, { headers });
      setDemoSeedState('success');
      setDemoSeedFeedback(String(res.data?.message ?? 'Dataset demo completo caricato con successo.'));
    } catch {
      setDemoSeedState('error');
      setDemoSeedFeedback('Caricamento dati demo non riuscito. Verifica flag backend e permessi admin.');
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
      if (event.key === 'Escape') setIsSearchOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return;
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    void (async () => {
      setSearchLoading(true);
      try {
        const res = await api.get('/v1/segnalazioni', { headers, params: { tenant_id: tenantId, search: searchQuery.trim(), page: 1, page_size: 8, sort: 'updated_at.desc' } });
        setSearchResults((res.data?.items ?? []) as Segnalazione[]);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    })();
  }, [headers, isSearchOpen, searchQuery, tenantId]);

  const nonLoginScreen = activeScreen !== 'login';

  return (
    <main className="app-shell mobile-shell">
      {nonLoginScreen && (
        <header className="app-topbar" aria-label="Barra superiore">
          <div>
            <p className="eyebrow topbar-eyebrow">{screenTitle[activeScreen as Exclude<Screen, 'login'>]}</p>
            <h1 className="topbar-brand">Città di {tenantName}</h1>
          </div>
          <div className="app-topbar__actions">
            <button type="button" aria-label="Cerca" className="icon-btn" onClick={() => setIsSearchOpen(true)}><TopbarIcon path="M11 4a7 7 0 1 0 4.95 11.95l4.05 4.05 1.4-1.4-4.05-4.05A7 7 0 0 0 11 4Z" /></button>
            <button type="button" aria-label="Documentazione pubblica" className="icon-btn" onClick={() => setActiveScreen('docs')}><TopbarIcon path="M6 4h9l3 3v13H6z M15 4v4h4 M9 11h6 M9 15h6" /></button>
            <button type="button" aria-label="Notifiche" className="icon-btn" onClick={() => setActiveScreen('notifiche')}><TopbarIcon path="M12 4a4 4 0 0 0-4 4v2.5c0 .9-.3 1.8-.9 2.5L6 14.5h12L16.9 13c-.6-.7-.9-1.6-.9-2.5V8a4 4 0 0 0-4-4ZM10 18a2 2 0 0 0 4 0" />{unreadNotifications > 0 && <span className="icon-badge">{Math.min(unreadNotifications, 9)}</span>}</button>
            <button type="button" aria-label="Profilo" className="icon-btn" onClick={() => setActiveScreen('profilo')}><TopbarIcon path="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-6 2.2-6 5h12c0-2.8-2.7-5-6-5Z" /></button>
          </div>
        </header>
      )}

      {activeScreen === 'login' && <Card className="screen institutional-login"><p className="eyebrow">Portale Istituzionale Segnalazioni</p><h1>Accedi con identità digitale</h1><p className="muted">Servizio comunale per segnalazioni, priorità e aggiornamenti sul territorio.</p><div className="spid-card"><strong>SPID / CIE</strong><p>Autenticazione sicura per cittadini e operatori.</p><Button type="button" variant="primary" onClick={() => setActiveScreen('home')}>Entra con SPID</Button></div></Card>}

      {activeScreen === 'home' && <section className="screen home-screen"><Card as="article"><h3>In evidenza</h3>{homeError && <p className="muted">{homeError}</p>}<div className="horizontal-list">{featuredItems.map((i) => <div key={i.title} className="feature-card"><Badge>{i.badge}</Badge><strong>{i.title}</strong><p>{i.text}</p></div>)}</div><Button type="button" variant="primary" onClick={openWizard}>Crea segnalazione</Button></Card><Card as="article"><h3>Le mie segnalazioni</h3><ul className="plain-list">{myReports.map((r) => <li key={r.id}><div><strong>{r.titolo}</strong><p>{r.id} • {r.stato}</p></div><small>{r.supporti} supporti</small></li>)}</ul></Card><Card as="article"><h3>Documentazione pubblica</h3><ul className="plain-list docs-list">{[...(publicDocs.global ?? []), ...(publicDocs.tenant ?? [])].map((d) => <li key={d.slug}>{d.title}</li>)}</ul></Card></section>}

      {activeScreen === 'notifiche' && (
        <section className="screen" data-testid="notifications-screen">
          <Card as="article">
            <h3>Centro notifiche</h3>
            <p className="muted">Feed eventi segnalazioni (stato, aggiornamenti, assegnazioni).</p>
            {notificationsState === 'loading' && <p className="muted">Caricamento notifiche...</p>}
            {notificationsMessage && <p className="muted">{notificationsMessage}</p>}
            <ul className="plain-list notifications-list" aria-label="Lista notifiche">
              {notifications.map((notification) => (
                <li key={notification.id} className={`notification-card notification-${notification.kind}`}>
                  <div>
                    <p className="eyebrow">{notification.kind}</p>
                    <strong>{notification.title}</strong>
                    <p>{notification.body}</p>
                  </div>
                  <small>{new Date(notification.timestamp).toLocaleString('it-IT')}</small>
                </li>
              ))}
            </ul>
            {notifications.length === 0 && notificationsState !== 'loading' && <p className="muted">Nessuna notifica disponibile.</p>}
          </Card>
        </section>
      )}

      {activeScreen === 'docs' && (
        <section className="screen" data-testid="public-docs-screen">
          <Card as="article">
            <h3>Documentazione pubblica</h3>
            <p className="muted">Contenuti informativi disponibili pubblicamente per cittadini e operatori.</p>
            <ul className="plain-list docs-list" aria-label="Elenco documentazione pubblica">
              {[...(publicDocs.global ?? []), ...(publicDocs.tenant ?? [])].map((d) => <li key={d.slug}>{d.title}</li>)}
            </ul>
          </Card>
        </section>
      )}

      {activeScreen === 'profilo' && (
        <section className="screen" data-testid="profile-screen">
          <Card as="article">
            <h3>Account</h3>
            <ul className="plain-list docs-list">
              <li><strong>User ID:</strong> {userId}</li>
              <li><strong>Tenant ID:</strong> {tenantId}</li>
              <li><strong>Ruolo:</strong> {(access?.portal_role ?? 'citizen').toUpperCase()}</li>
            </ul>
            <h4>Accessi</h4>
            {userSettingsLinks.length > 0 ? <ul className="plain-list docs-list settings-links">{userSettingsLinks.map((link) => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul> : <p className="muted">Nessuna area amministrativa disponibile per il tuo profilo.</p>}
          </Card>

          <Card as="article" aria-label="Modalità test">
            <div className="dev-profile-switcher__header"><h3>Modalità test</h3><Badge tone="warning">MODALITÀ TEST</Badge></div>
            {devProfileSwitchEnabled && (
              <div className="dev-profile-switcher" data-testid="dev-profile-switcher">
                <label>Profilo simulato<select aria-label="Profilo sviluppo" value={selectedDevProfile} onChange={(e) => onDevProfileChange(e.target.value as DevProfileKey)}>{devProfiles.map((profile) => <option key={profile.key} value={profile.key}>{profile.label}</option>)}</select></label>
              </div>
            )}
            <div className="inline-actions"><Button type="button" onClick={() => setThemeMode((t) => t === 'light' ? 'dark' : 'light')}>Tema: {themeMode === 'light' ? 'Chiaro' : 'Scuro'}</Button></div>
            <p className="muted">Header API effettivi: x-user-id {userId} • x-tenant-id {tenantId}</p>
            {isAdmin && <section className="demo-mode-panel" aria-label="Modalità Test DB"><h4>Modalità Test DB</h4><p className="muted warning-text">⚠️ Solo sviluppo locale. Non abilitare in produzione. Flag richiesto: ENABLE_DEMO_MODE_SWITCH=true.</p><p className="muted">Stato corrente: <strong>{demoModeState === 'on' ? 'ON' : demoModeState === 'off' ? 'OFF' : 'SCONOSCIUTO'}</strong></p><div className="inline-actions"><Button type="button" onClick={() => switchDemoMode('on')} disabled={demoModeBusy || demoSeedState === 'loading'}>ON</Button><Button type="button" onClick={() => switchDemoMode('off')} disabled={demoModeBusy || demoSeedState === 'loading'}>OFF</Button><Button type="button" onClick={() => void loadFullDemoData()} disabled={demoModeBusy || demoSeedState === 'loading'}>{demoSeedState === 'loading' ? 'Caricamento...' : 'Carica dati demo completi'}</Button></div>{demoModeFeedback && <p className="success-text">{demoModeFeedback}</p>}{demoSeedFeedback && <p className={demoSeedState === 'error' ? 'error-text' : 'success-text'}>{demoSeedFeedback}</p>}{demoModeOutput && <p className="muted demo-mode-output">{demoModeOutput}</p>}</section>}
          </Card>
        </section>
      )}

      {activeScreen === 'wizard' && <Card className="screen wizard-shell" testId="wizard-shell">
        <header className="wizard-head">
          <p className="eyebrow">Nuova segnalazione</p>
          <h2>Procedura guidata</h2>
          <div className="wizard-progress" aria-label={`Step ${wizardStep} di 3`}>
            {[1, 2, 3].map((step) => <span key={step} className={step <= wizardStep ? 'is-done' : ''} />)}
          </div>
        </header>

        {wizardStep === 1 && <form className="screen wizard-step" onSubmit={wizardStep1}><p className="muted">Step 1 di 3 • Descrizione del problema</p><label>Titolo<Input aria-label="Titolo segnalazione" value={wizardTitle} onChange={(e) => setWizardTitle(e.target.value)} /></label><label>Descrizione<TextArea aria-label="Descrizione segnalazione" value={wizardDescription} onChange={(e) => setWizardDescription(e.target.value)} /></label>{wizardError && <p className="error-text">{wizardError}</p>}<div className="row-actions"><Button type="button" onClick={() => setActiveScreen('home')}>Annulla</Button><Button type="submit" variant="primary">Prosegui</Button></div></form>}

        {wizardStep === 2 && <div className="screen wizard-step"><p className="muted">Step 2 di 3 • Verifica duplicati</p><div className="ai-insight" aria-label="Suggerimento duplicati"><p className="eyebrow">Verifica automatica</p><strong>{duplicateCandidates.length > 0 ? 'Segnalazioni simili trovate' : 'Nessun duplicato rilevante trovato'}</strong><p>{duplicateMode === 'endpoint' ? 'Controllo effettuato con endpoint dedicato duplicati.' : 'Controllo effettuato tramite ricerca deterministica su elenco segnalazioni.'}</p></div><ul className="plain-list wizard-duplicate-list">{duplicateCandidates.map((d) => <li key={d.id ?? d.codice}><div><strong>{d.titolo ?? 'Segnalazione simile'}</strong><p>{d.codice ?? d.id} • {statoLabel(d.stato)}</p></div><Button type="button" onClick={() => setWizardDuplicateOf(d.id ?? '')}>{wizardDuplicateOf === d.id ? 'Selezionata' : 'Segna come simile'}</Button></li>)}</ul><div className="row-actions"><Button type="button" onClick={() => setWizardStep(1)}>Indietro</Button><Button type="button" variant="primary" onClick={() => setWizardStep(3)}>Continua</Button></div></div>}

        {wizardStep === 3 && <form className="screen wizard-step" onSubmit={submitWizard}><p className="muted">Step 3 di 3 • Conferma e invio</p><div className="wizard-layout"><div className="wizard-main"><label>Indirizzo / riferimento area<Input aria-label="Indirizzo segnalazione" value={wizardAddress} onChange={(e) => { setWizardAddress(e.target.value); setWizardAddressValidation(null); }} /></label><ul className="plain-list docs-list wizard-suggestions">{wizardAddressSuggestions.map((item) => <li key={item.id}><Button type="button" onClick={() => { setWizardAddress(item.address); setWizardAddressCatalogId(item.id); setWizardAddressValidation(null); }}>{item.address} • {item.reference_code}</Button></li>)}</ul><div className="inline-actions"><Button type="button" onClick={() => void validateWizardAddress()}>Valida indirizzo</Button>{wizardAddressValidation?.validated ? <span className="success-text">Indirizzo verificato</span> : <span className="muted">Indirizzo non verificato</span>}</div></div><aside className="wizard-aside"><label>Tag guidati</label><Input aria-label="Ricerca tag segnalazione" placeholder="Cerca tag" value={wizardTagFilter} onChange={(e) => setWizardTagFilter(e.target.value)} /><div className="chips" aria-label="Tag assistiti">{wizardTagOptions.map((tag) => <button type="button" key={tag.id} className={wizardSelectedTagSlugs.includes(tag.slug) ? 'ui-chip is-active' : 'ui-chip'} onClick={() => setWizardSelectedTagSlugs((current) => current.includes(tag.slug) ? current.filter((entry) => entry !== tag.slug) : [...current, tag.slug].slice(0, 10))}>{tag.label}</button>)}</div>{wizardSelectedTagSlugs.length > 0 && <p className="muted">Selezionati: {wizardSelectedTagSlugs.join(', ')}</p>}</aside></div>{wizardError && <p className="error-text">{wizardError}</p>}<div className="row-actions"><Button type="button" onClick={() => setWizardStep(2)}>Indietro</Button><Button type="submit" variant="primary" disabled={wizardLoading || !wizardAddressValidation?.validated}>{wizardLoading ? 'Invio...' : 'Invia segnalazione'}</Button></div></form>}
      </Card>}

      {activeScreen === 'priorita' && <Card className="screen priority-shell" testId="priority-shell"><header className="priority-head"><div><p className="eyebrow">Classifica segnalazioni</p><h2>Priorità del territorio</h2></div><Badge>{priorityItems.length} elementi</Badge></header><div className="chips" aria-label="Categorie priorità">{Array.from(new Set(priorityItems.map((p) => p.categoria))).slice(0, 6).map((cat) => <Chip key={cat}>{cat}</Chip>)}</div><ul className="plain-list priority-list">{priorityItems.map((p) => <li key={p.id} className="priority-item"><div><strong>{p.titolo}</strong><p>{p.categoria} • Trend {p.trend}</p></div><Button type="button" onClick={() => toggleSupport(p.id)}>Supporta ({p.supporti})</Button></li>)}</ul>{priorityItems.length === 0 && <p className="muted">Nessuna priorità disponibile al momento.</p>}</Card>}

      {activeScreen === 'dettaglio' && <section className="screen detail-screen" data-testid="detail-screen"><Card as="article" className="detail-hero"><p className="eyebrow">Dettaglio segnalazione</p>{detail ? <><h2>{detail.codice ?? detail.id} • {detail.titolo ?? 'Segnalazione inviata'}</h2><p className="success-text">Segnalazione registrata con successo. Conserva il codice pubblico per il monitoraggio.</p>{detail.timeline && detail.timeline.length > 0 && <ol className="timeline" aria-label="Timeline stato">{detail.timeline.map((t, i) => <li key={t.id ?? i}><strong>{t.message ?? t.event_type ?? 'Aggiornamento'}</strong><span>{t.created_at ? new Date(t.created_at).toLocaleString('it-IT') : 'Ora non disponibile'}</span></li>)}</ol>}</> : <h2>Nessuna segnalazione disponibile per il dettaglio.</h2>}</Card><Card as="article" className="detail-content"><h3>Descrizione</h3><p>{detail?.descrizione ?? 'Nessun contenuto disponibile.'}</p></Card></section>}

      {isSearchOpen && (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Ricerca segnalazioni">
          <Card as="section" className="search-modal">
            <div className="dev-profile-switcher__header">
              <h3>Ricerca segnalazioni</h3>
              <Button type="button" onClick={() => setIsSearchOpen(false)}>Chiudi</Button>
            </div>
            <Input aria-label="Ricerca segnalazioni" placeholder="Titolo o descrizione (min 2 caratteri)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchLoading && <p className="muted">Ricerca in corso...</p>}
            {!searchLoading && searchQuery.trim().length >= 2 && (
              <ul className="plain-list" aria-label="Risultati ricerca segnalazioni">
                {searchResults.map((item) => <li key={item.id ?? item.codice}><div><strong>{item.titolo ?? 'Segnalazione'}</strong><p>{item.id ?? item.codice} • {statoLabel(item.stato)}</p></div></li>)}
              </ul>
            )}
            {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && <p className="muted">Nessun risultato per questa ricerca.</p>}
          </Card>
        </div>
      )}

      {activeScreen !== 'login' && <BottomNav
        activeKey={activeScreen}
        items={[
          { key: 'home', label: 'Home', icon: '🏠', onClick: () => setActiveScreen('home') },
          { key: 'wizard', label: 'Nuova', icon: '➕', onClick: openWizard },
          { key: 'priorita', label: 'Priorità', icon: '📊', onClick: () => setActiveScreen('priorita') },
          { key: 'notifiche', label: 'Notifiche', icon: '🔔', onClick: () => setActiveScreen('notifiche') },
          { key: 'profilo', label: 'Profilo', icon: '👤', onClick: () => setActiveScreen('profilo') }
        ]}
      />}
    </main>
  );
}
