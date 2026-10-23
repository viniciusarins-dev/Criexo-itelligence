-- =============================================================================
-- Etapa 7 — revisão humana de duplicidades e recálculo de pontuação
--   * duplicate_reviews: registro de uma fonte que parece ser uma empresa já
--     cadastrada. Nada é unido até uma pessoa decidir (seção 7).
--   * resolve_duplicate_review(): aplica a decisão e grava quem decidiu, na
--     mesma transação.
--   * record_score_recalculation(): registra no histórico da oportunidade que a
--     pontuação foi recalculada.
-- =============================================================================

create type public.duplicate_review_status as enum ('pending', 'same_company', 'different_company');

create table public.duplicate_reviews (
  id uuid primary key default gen_random_uuid(),
  -- Empresa já cadastrada que parece ser a mesma.
  company_id uuid not null references public.companies (id),
  source_name text not null check (char_length(source_name) between 1 and 80),
  source_record_id text not null check (char_length(source_record_id) between 1 and 200),
  source_url text check (source_url is null or source_url ~* '^https?://'),
  -- Dados como vieram da fonte (colunas de `companies` + `field_provenance`).
  candidate jsonb not null check (jsonb_typeof(candidate) = 'object' and char_length(trim(candidate ->> 'name')) between 1 and 200),
  reasons text[] not null default '{}',
  research_session_id uuid references public.research_sessions (id),
  status public.duplicate_review_status not null default 'pending',
  resolved_company_id uuid references public.companies (id),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 2000),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint duplicate_reviews_decision_consistency check (
    (status = 'pending' and decided_at is null and decided_by is null and resolved_company_id is null)
    or (status <> 'pending' and decided_at is not null and decided_by is not null and resolved_company_id is not null)
  )
);

-- Um mesmo registro da fonte só fica uma vez na fila.
create unique index duplicate_reviews_pending_idx
  on public.duplicate_reviews (source_name, source_record_id) where status = 'pending';
create index duplicate_reviews_status_idx on public.duplicate_reviews (status, created_at desc);

revoke all on public.duplicate_reviews from anon, authenticated;
grant select on public.duplicate_reviews to authenticated;
-- A decisão só muda pela função abaixo.
grant insert (company_id, source_name, source_record_id, source_url, candidate, reasons, research_session_id, created_by)
  on public.duplicate_reviews to authenticated;

alter table public.duplicate_reviews enable row level security;
create policy duplicate_reviews_select on public.duplicate_reviews for select to authenticated
  using ((select private.is_active_member()));
create policy duplicate_reviews_insert on public.duplicate_reviews for insert to authenticated
  with check ((select private.is_active_member()) and created_by = (select auth.uid()) and status = 'pending');

create or replace function public.resolve_duplicate_review(
  p_review_id uuid,
  p_decision public.duplicate_review_status,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_review public.duplicate_reviews;
  v_company public.companies;
  v_candidate jsonb;
  v_entry jsonb;
  v_provenance jsonb;
  v_has_location boolean;
  v_result uuid;
begin
  if not private.is_active_member() then
    raise exception 'permissão insuficiente' using errcode = '42501';
  end if;
  if p_decision = 'pending' then
    raise exception 'a decisão deve ser "mesma empresa" ou "empresas diferentes"' using errcode = '22023';
  end if;

  select * into v_review from public.duplicate_reviews where id = p_review_id for update;
  if not found then
    raise exception 'revisão não encontrada' using errcode = 'P0002';
  end if;
  if v_review.status <> 'pending' then
    raise exception 'esta revisão já foi decidida' using errcode = '55000';
  end if;

  v_candidate := v_review.candidate;
  v_entry := jsonb_build_object('status', 'source_declared', 'source', v_review.source_name, 'observedAt', now());
  v_has_location := (v_candidate ->> 'latitude') is not null and (v_candidate ->> 'longitude') is not null;

  if p_decision = 'same_company' then
    -- Liga o registro da fonte à empresa e só completa campos vazios.
    select * into v_company from public.companies where id = v_review.company_id for update;
    v_provenance := v_company.field_provenance;
    if v_company.segment is null and v_candidate ->> 'segment' is not null then v_provenance := v_provenance || jsonb_build_object('segment', v_entry); end if;
    if v_company.website is null and v_candidate ->> 'website' is not null then v_provenance := v_provenance || jsonb_build_object('website', v_entry); end if;
    if v_company.phone is null and v_candidate ->> 'phone' is not null then v_provenance := v_provenance || jsonb_build_object('phone', v_entry); end if;
    if v_company.address is null and v_candidate ->> 'address' is not null then v_provenance := v_provenance || jsonb_build_object('address', v_entry); end if;
    if v_company.neighborhood is null and v_candidate ->> 'neighborhood' is not null then v_provenance := v_provenance || jsonb_build_object('neighborhood', v_entry); end if;
    if v_company.city is null and v_candidate ->> 'city' is not null then v_provenance := v_provenance || jsonb_build_object('city', v_entry); end if;
    if v_company.state is null and v_candidate ->> 'state' is not null then v_provenance := v_provenance || jsonb_build_object('state', v_entry); end if;
    if v_company.postal_code is null and v_candidate ->> 'postal_code' is not null then v_provenance := v_provenance || jsonb_build_object('postalCode', v_entry); end if;
    if v_company.latitude is null and v_has_location then v_provenance := v_provenance || jsonb_build_object('location', v_entry); end if;

    update public.companies c set
      segment = coalesce(c.segment, v_candidate ->> 'segment'),
      website = coalesce(c.website, v_candidate ->> 'website'),
      website_domain = case when c.website is null then v_candidate ->> 'website_domain' else c.website_domain end,
      phone = coalesce(c.phone, v_candidate ->> 'phone'),
      phone_normalized = case when c.phone is null then v_candidate ->> 'phone_normalized' else c.phone_normalized end,
      address = coalesce(c.address, v_candidate ->> 'address'),
      neighborhood = coalesce(c.neighborhood, v_candidate ->> 'neighborhood'),
      city = coalesce(c.city, v_candidate ->> 'city'),
      state = coalesce(c.state, v_candidate ->> 'state'),
      postal_code = coalesce(c.postal_code, v_candidate ->> 'postal_code'),
      latitude = case when c.latitude is null and v_has_location then (v_candidate ->> 'latitude')::double precision else c.latitude end,
      longitude = case when c.latitude is null and v_has_location then (v_candidate ->> 'longitude')::double precision else c.longitude end,
      location_status = case when c.latitude is null and v_has_location then 'source_declared'::public.information_status else c.location_status end,
      field_provenance = v_provenance,
      updated_at = now()
    where c.id = v_review.company_id;
    v_result := v_review.company_id;
  else
    -- Empresas diferentes: cadastra a da fonte como nova.
    insert into public.companies (
      name, normalized_name, segment, website, website_domain, phone, phone_normalized, address, neighborhood,
      city, state, postal_code, latitude, longitude, location_status, field_provenance, created_by
    ) values (
      v_candidate ->> 'name', v_candidate ->> 'normalized_name', v_candidate ->> 'segment', v_candidate ->> 'website',
      v_candidate ->> 'website_domain', v_candidate ->> 'phone', v_candidate ->> 'phone_normalized', v_candidate ->> 'address',
      v_candidate ->> 'neighborhood', v_candidate ->> 'city', v_candidate ->> 'state', v_candidate ->> 'postal_code',
      case when v_has_location then (v_candidate ->> 'latitude')::double precision end,
      case when v_has_location then (v_candidate ->> 'longitude')::double precision end,
      case when v_has_location then 'source_declared'::public.information_status else 'unknown'::public.information_status end,
      coalesce(v_candidate -> 'field_provenance', '{}'::jsonb),
      v_user
    ) returning id into v_result;
  end if;

  insert into public.company_sources (company_id, research_session_id, source_name, source_record_id, source_url, last_verified_at, evidence_metadata)
  values (v_result, v_review.research_session_id, v_review.source_name, v_review.source_record_id, v_review.source_url, now(),
          jsonb_build_object('duplicateReviewId', v_review.id))
  on conflict (source_name, source_record_id) where source_record_id is not null do nothing;

  update public.duplicate_reviews
     set status = p_decision, resolved_company_id = v_result, decided_by = v_user, decided_at = now(),
         decision_note = nullif(trim(p_note), '')
   where id = p_review_id;

  return v_result;
end;
$$;

revoke all on function public.resolve_duplicate_review(uuid, public.duplicate_review_status, text) from public, anon;
grant execute on function public.resolve_duplicate_review(uuid, public.duplicate_review_status, text) to authenticated;

create or replace function public.record_score_recalculation(p_opportunity_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_member() then
    raise exception 'permissão insuficiente' using errcode = '42501';
  end if;
  if not exists (select 1 from public.opportunities where id = p_opportunity_id) then
    raise exception 'oportunidade não encontrada' using errcode = 'P0002';
  end if;
  insert into public.commercial_activities (opportunity_id, user_id, activity_type, note)
  values (p_opportunity_id, (select auth.uid()), 'score_recalculated', left(nullif(trim(p_note), ''), 5000));
end;
$$;

revoke all on function public.record_score_recalculation(uuid, text) from public, anon;
grant execute on function public.record_score_recalculation(uuid, text) to authenticated;
