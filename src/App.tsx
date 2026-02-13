import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';

type Access = {
  user_id: string;
  tenant_id: string;
  roles: string[];
  can_manage_branding: boolean;
  can_manage_roles: boolean;
};

type Branding = {
  logo_url?: string | null;
  primary_color: string;
  secondary_color: string;
  font_family?: string | null;
  header_variant?: 'standard' | 'compact' | null;
  footer_text?: string | null;
};

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
  const [managedUserId, setManagedUserId] = useState('');

  const headers = { 'x-user-id': userId, 'x-tenant-id': tenantId };

  const loadContext = async () => {
    const [prefRes, accessRes, brandingRes] = await Promise.all([
      api.get('/v1/me/preferences', { headers }),
      api.get('/v1/me/access', { headers }),
      api.get(`/v1/tenants/${tenantId}/branding`, { headers }).catch(() => ({ data: { primary_color: '#0055A4', secondary_color: '#FFFFFF' } }))
    ]);

    setLanguage(prefRes.data.language ?? 'it');
    setAccess(accessRes.data);
    setBranding(brandingRes.data);
  };

  useEffect(() => {
    void loadContext();
  }, [tenantId, userId]);

  const onLanguageSave = async (e: FormEvent) => {
    e.preventDefault();
    await api.put('/v1/me/preferences/language', { language }, { headers });
  };

  const onBrandingSave = async (e: FormEvent) => {
    e.preventDefault();
    await api.put(`/v1/tenants/${tenantId}/branding`, branding, { headers });
  };

  const assignTenantAdmin = async () => {
    if (!managedUserId) return;
    await api.put(`/v1/admin/roles/${managedUserId}`, { tenant_id: tenantId, role_code: 'tenant_admin' }, { headers });
  };

  return (
    <main className="shell">
      <header className="topbar">
        <h1>Portale PA</h1>
        <p>Area impostazioni istituzionali (Fase 4)</p>
        <div className="identity-grid">
          <label>Tenant ID<input value={tenantId} onChange={(e) => setTenantId(e.target.value)} /></label>
          <label>User ID<input value={userId} onChange={(e) => setUserId(e.target.value)} /></label>
        </div>
      </header>

      <section className="page card">
        <h2>Impostazioni utente / User settings</h2>
        <form onSubmit={onLanguageSave}>
          <label>
            Lingua applicazione
            <select aria-label="Lingua" value={language} onChange={(e) => setLanguage(e.target.value as 'it' | 'en')}>
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </label>
          <button type="submit">Salva lingua</button>
        </form>
      </section>

      {access?.can_manage_branding && (
        <section className="page card">
          <h2>Amministrazione comunale - Branding</h2>
          <form onSubmit={onBrandingSave} className="wizard-grid">
            <label>Logo URL<input aria-label="Logo URL" value={branding.logo_url ?? ''} onChange={(e) => setBranding((b) => ({ ...b, logo_url: e.target.value || null }))} /></label>
            <label>Colore primario<input aria-label="Colore primario" value={branding.primary_color} onChange={(e) => setBranding((b) => ({ ...b, primary_color: e.target.value }))} /></label>
            <label>Colore secondario<input aria-label="Colore secondario" value={branding.secondary_color} onChange={(e) => setBranding((b) => ({ ...b, secondary_color: e.target.value }))} /></label>
            <button type="submit">Salva branding</button>
          </form>
        </section>
      )}

      {access?.can_manage_roles && (
        <section className="page card">
          <h2>Global admin - Gestione accessi multi-tenant</h2>
          <label>
            User ID da promuovere
            <input aria-label="User ID da promuovere" value={managedUserId} onChange={(e) => setManagedUserId(e.target.value)} />
          </label>
          <button onClick={assignTenantAdmin}>Assegna ruolo tenant_admin</button>
        </section>
      )}

      {!access?.can_manage_branding && <section className="page card">Nessun accesso amministrativo branding per il profilo corrente.</section>}
    </main>
  );
}
