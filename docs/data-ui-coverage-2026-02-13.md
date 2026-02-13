# Portale PA — Data→UI Coverage Audit (2026-02-13)

## 1) Inventory: populated tables/fields (demo dataset)

Source: `sql/init/*.sql` + `sql/seeds/demo.sql`.

### Core populated tables
- `tenants`: id, name, codice_fiscale_ente
- `user_profiles`: id, tenant_id, full_name, email, language
- `user_roles` + `roles`: role mapping (citizen/maintainer/admin via legacy roles)
- `tenant_branding`: primary_color, secondary_color, footer_text
- `segnalazione_categories`: slug, name, color, sort_order
- `tenant_tag_catalog`: slug, label, sort_order, is_active
- `tenant_address_catalog`: reference_code, address, lat/lng, source_dataset, is_active
- `segnalazioni`: codice, titolo, descrizione, stato, priorita, severita, category_id, address, lat/lng, tags, validated_address_catalog_id, address_validation, created_by, updated_at
- `segnalazione_votes`: user support rows
- `segnalazione_timeline_events`: event_type, message, created_at, created_by
- `global_docs`, `tenant_docs`: slug/title/content/sort/published

## 2) Current UI coverage map

### Already shown in frontend
- Home: titolo/stato (featured), own reports basic status/supports, docs list.
- Priorità: titolo/categoria/trend/supporti.
- Dettaglio: codice/id, titolo, descrizione, timeline.
- Profilo: user/tenant/role + test/admin controls.
- Wizard: assisted tags + assisted addresses + strict address validation.

### Partially shown
- `segnalazioni.priorita` -> only used indirectly in backend ranking; now surfaced in home cards/reports.
- `segnalazioni.severita` -> backend ranking only; now surfaced in home featured text.
- `segnalazioni.address` -> available but previously hidden; now surfaced in home featured/reports.
- `segnalazioni.codice` -> shown in dettaglio; now emphasized in “Le mie segnalazioni”.

### Not shown yet (high-value)
- `segnalazioni.tags` (public context labels)
- `segnalazioni.category_id` color/legend in home cards
- `segnalazioni.validated_address_catalog_id` + `address_validation.reference_code`
- `segnalazioni.public_response`
- `segnalazioni.moderation_flags` (admin/maintainer only)
- `segnalazione_follows` counters and state
- `segnalazione_report_snapshots` trend history
- `tenant_branding.footer_text`
- `tenant_address_catalog.source_dataset` (ops/internal)

## 3) Non-shown data: decision proposal (show now / later / deprecate)

### Show now (low-risk/high-value)
1. `segnalazioni.tags` on Home + Dettaglio chips.
2. `public_response` in Dettaglio as “Risposta ufficiale”.
3. `address_validation.reference_code` in Dettaglio metadata.
4. `follows_count` near supporti in Priorità/Dettaglio.

### Show later (needs UX/permissions)
1. `moderation_flags` (admin-only panel).
2. `report_snapshots` (status timeline chart).
3. `tenant_branding.footer_text` in persistent footer.
4. `source_dataset` and validation confidence (operator tools only).

### Deprecate/remove candidate
- Legacy duplicate identity fields usage overlap (`created_by/reported_by/user_id/author_id`): keep compatibility now, consolidate in next schema cleanup.

## 4) Concrete wave implemented in this step

Implemented (frontend):
1. **AI Assistant CTA on Home** (`Apri Assistente AI`) opening a chat-like responsive modal overlay.
2. **AI Insight card on Home** with automatic suggestions derived from live DB-backed data (`/v1/segnalazioni` + `/v1/segnalazioni/priorities`) focusing on:
   - high-priority/high-severity items
   - waiting backlog count
   - top supported priority trend
3. **First missing-data surfacing wave** on Home cards/lists:
   - priorità
   - severità
   - area/address
   - codice in “Le mie segnalazioni”

## 5) Remaining unseen data: concise placement proposal list

- Home > featured card footer: `tags` (max 2 + “+N”).
- Dettaglio > metadata box: `priorita`, `severita`, `address`, `reference_code`, `validated` badge.
- Dettaglio > official updates section: `public_response`.
- Priorità list: append `follows_count` and `stato` badge.
- Profilo/Admin: moderation snapshots + flags (role-gated).

Decision needed from user for each item: implement now vs phase next sprint.
