-- =============================================================================
-- CRIEXO Intelligence — esquema inicial
--
-- Princípios aplicados:
--   * Todo acesso passa por RLS; nada é liberado para o papel `anon`.
--   * Somente perfis ATIVOS (liberados por um administrador) acessam dados
--     internos. Um usuário autenticado porém não liberado não vê nada.
--   * Históricos (decisões de ideias, atividades comerciais, pontuações,
--     configurações) são somente-inclusão: não há políticas de UPDATE/DELETE.
--   * Mudanças que exigem histórico (status comercial, aprovação de ideias)
--     acontecem apenas por funções que gravam o histórico na mesma transação;
--     as colunas correspondentes não podem ser alteradas diretamente.
--   * Não há exclusão física de registros de negócio nesta versão.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'member');

create type public.research_type as enum ('segment', 'product');

create type public.research_status as enum (
  'draft',              -- criada, ainda sem sugestões
  'awaiting_approval',  -- sugestões geradas, aguardando decisão
  'ready',              -- ao menos uma ideia aprovada, nenhuma pendente
  'running',            -- consultando fontes
  'completed',          -- todas as fontes responderam
  'partial',            -- parte das fontes falhou ou poucos resultados
  'failed',             -- nenhuma fonte respondeu
  'cancelled'
);

create type public.approval_status as enum ('pending', 'approved', 'rejected');

-- RN-12: distinção explícita da natureza de cada informação.
create type public.information_status as enum (
  'confirmed',        -- verificada por uma pessoa
  'source_declared',  -- declarada por uma fonte externa
  'ai_inference',     -- inferida por IA
  'unknown',          -- desconhecida
  'outdated'          -- conhecida, mas desatualizada
);

create type public.source_run_status as enum (
  'pending', 'running', 'succeeded', 'failed', 'skipped', 'rate_limited'
);

create type public.activity_type as enum (
  'status_change', 'note', 'contact', 'saved', 'unsaved', 'score_recalculated'
);

create type public.idea_origin as enum ('ai', 'manual');

-- -----------------------------------------------------------------------------
-- Funções utilitárias
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfis
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  role public.app_role not null default 'member',
  -- Usuário só acessa dados internos depois de liberado por um administrador.
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Funções de autorização ficam em um schema não exposto pela API.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.role = 'admin'
  );
$$;

revoke all on function private.is_active_member() from public;
revoke all on function private.is_admin() from public;
grant execute on function private.is_active_member() to authenticated;
grant execute on function private.is_admin() to authenticated;

-- Todo novo usuário do Auth ganha um perfil INATIVO.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'usuario'), '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Administradores alteram papel e liberação de acesso apenas por esta função.
create or replace function public.admin_set_member_access(
  p_user_id uuid,
  p_role public.app_role,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'permissão insuficiente' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) and (p_role <> 'admin' or not p_is_active) then
    raise exception 'um administrador não pode remover o próprio acesso administrativo'
      using errcode = '42501';
  end if;
  update public.profiles
     set role = p_role, is_active = p_is_active
   where id = p_user_id;
  if not found then
    raise exception 'perfil não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_member_access(uuid, public.app_role, boolean) from public, anon;
grant execute on function public.admin_set_member_access(uuid, public.app_role, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Configurações
-- -----------------------------------------------------------------------------

-- Pares chave/valor (ponto de referência, raio, preferências...). Valores
-- ausentes significam "configuração pendente" — não há valores padrão
-- inventados para raio, endereço ou capacidade.
create table public.system_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.]{1,80}$'),
  value jsonb not null,
  updated_by uuid not null default auth.uid() references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.system_settings_history (
  id bigint generated always as identity primary key,
  key text not null,
  previous_value jsonb,
  new_value jsonb,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);

create or replace function private.log_system_setting_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce((select auth.uid()), new.updated_by);
  insert into public.system_settings_history (key, previous_value, new_value, changed_by)
  values (
    new.key,
    case when tg_op = 'UPDATE' then old.value end,
    new.value,
    new.updated_by
  );
  return new;
end;
$$;

create trigger system_settings_history
before insert or update on public.system_settings
for each row execute function private.log_system_setting_change();

-- Limites de capacidade produtiva informados manualmente (RN-05).
-- Cada alteração gera uma nova linha; a linha mais recente é a vigente.
create table public.production_settings (
  id uuid primary key default gen_random_uuid(),
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index production_settings_created_at_idx on public.production_settings (created_at desc);

-- Configurações de pontuação versionadas e imutáveis (RN-08).
create table public.scoring_configs (
  version integer primary key check (version > 0),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  -- 'proposal' = pesos sugeridos ainda não validados pelo negócio.
  approval_state text not null default 'proposal'
    check (approval_state in ('proposal', 'approved')),
  notes text,
  is_active boolean not null default false,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create unique index scoring_configs_single_active_idx
  on public.scoring_configs (is_active) where is_active;

-- Troca a versão de pontuação vigente sem alterar versões anteriores.
create or replace function public.activate_scoring_config(p_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'permissão insuficiente' using errcode = '42501';
  end if;
  if not exists (select 1 from public.scoring_configs where version = p_version) then
    raise exception 'versão de pontuação não encontrada' using errcode = 'P0002';
  end if;
  update public.scoring_configs set is_active = false where is_active and version <> p_version;
  update public.scoring_configs set is_active = true where version = p_version;
end;
$$;

revoke all on function public.activate_scoring_config(integer) from public, anon;
grant execute on function public.activate_scoring_config(integer) to authenticated;

-- Status comerciais configuráveis (pipeline).
create table public.commercial_statuses (
  key text primary key check (key ~ '^[a-z][a-z_]{1,40}$'),
  label text not null check (char_length(label) between 1 and 60),
  position integer not null unique,
  -- open = em andamento, won = convertida, lost = descartada
  category text not null check (category in ('open', 'won', 'lost')),
  is_active boolean not null default true
);

insert into public.commercial_statuses (key, label, position, category) values
  ('nova', 'Nova', 10, 'open'),
  ('para_analisar', 'Para analisar', 20, 'open'),
  ('contato_pendente', 'Contato pendente', 30, 'open'),
  ('contatada', 'Contatada', 40, 'open'),
  ('em_negociacao', 'Em negociação', 50, 'open'),
  ('convertida', 'Convertida', 60, 'won'),
  ('descartada', 'Descartada', 70, 'lost');

-- -----------------------------------------------------------------------------
-- Pesquisas
-- -----------------------------------------------------------------------------
create table public.research_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles (id),
  research_type public.research_type not null,
  query text not null check (char_length(trim(query)) between 2 and 200),
  objective text check (objective is null or char_length(objective) <= 2000),
  region_label text check (region_label is null or char_length(region_label) <= 200),
  reference_latitude double precision check (reference_latitude between -90 and 90),
  reference_longitude double precision check (reference_longitude between -180 and 180),
  radius_km numeric(6, 2) check (radius_km is null or (radius_km > 0 and radius_km <= 500)),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  status public.research_status not null default 'draft',
  -- Cópia das configurações vigentes no momento da pesquisa (raio, capacidade,
  -- versão de pontuação), para que a pesquisa continue explicável depois.
  configuration_snapshot jsonb not null default '{}'::jsonb,
  rerun_of uuid references public.research_sessions (id),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint research_reference_point_complete check (
    (reference_latitude is null) = (reference_longitude is null)
  )
);

create index research_sessions_created_at_idx on public.research_sessions (created_at desc);
create index research_sessions_status_idx on public.research_sessions (status);

create trigger research_sessions_set_updated_at
before update on public.research_sessions
for each row execute function public.set_updated_at();

-- Resultado de cada fonte em cada pesquisa: permite dizer quais fontes
-- responderam e quais falharam.
create table public.research_source_runs (
  id uuid primary key default gen_random_uuid(),
  research_session_id uuid not null references public.research_sessions (id),
  source_name text not null check (char_length(source_name) between 1 and 80),
  status public.source_run_status not null default 'pending',
  results_count integer check (results_count is null or results_count >= 0),
  error_message text,
  request_metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index research_source_runs_session_idx on public.research_source_runs (research_session_id);

-- -----------------------------------------------------------------------------
-- Ideias de produto
-- -----------------------------------------------------------------------------
create table public.product_ideas (
  id uuid primary key default gen_random_uuid(),
  research_session_id uuid references public.research_sessions (id),
  name text not null check (char_length(trim(name)) between 2 and 160),
  normalized_name text not null,
  description text,
  problem_statement text,
  target_segment text,
  proposed_application text,
  expected_benefit text,
  -- Lista de { statement, information_status } — premissas e evidências.
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  technical_constraints text,
  missing_information text,
  origin public.idea_origin not null,
  ai_provider text,
  ai_model text,
  approval_status public.approval_status not null default 'pending',
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_ideas_decision_consistency check (
    (approval_status = 'pending' and decided_by is null and decided_at is null)
    or (approval_status <> 'pending' and decided_by is not null and decided_at is not null)
  ),
  constraint product_ideas_ai_metadata check (
    origin <> 'ai' or ai_provider is not null
  )
);

create index product_ideas_session_idx on public.product_ideas (research_session_id);
create index product_ideas_normalized_name_idx on public.product_ideas (normalized_name);
create index product_ideas_approval_idx on public.product_ideas (approval_status);

create trigger product_ideas_set_updated_at
before update on public.product_ideas
for each row execute function public.set_updated_at();

create table public.product_idea_decisions (
  id bigint generated always as identity primary key,
  product_idea_id uuid not null references public.product_ideas (id),
  previous_status public.approval_status not null,
  new_status public.approval_status not null,
  decided_by uuid not null references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create index product_idea_decisions_idea_idx on public.product_idea_decisions (product_idea_id);

-- RN-03: decisão individual, registrada com responsável e data.
create or replace function public.decide_product_idea(
  p_idea_id uuid,
  p_decision public.approval_status,
  p_note text default null
)
returns public.product_ideas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_idea public.product_ideas;
  v_user uuid := (select auth.uid());
begin
  if not private.is_active_member() then
    raise exception 'permissão insuficiente' using errcode = '42501';
  end if;
  if p_decision = 'pending' then
    raise exception 'a decisão deve ser aprovar ou rejeitar' using errcode = '22023';
  end if;

  select * into v_idea from public.product_ideas where id = p_idea_id for update;
  if not found then
    raise exception 'ideia não encontrada' using errcode = 'P0002';
  end if;

  insert into public.product_idea_decisions (product_idea_id, previous_status, new_status, decided_by, note)
  values (p_idea_id, v_idea.approval_status, p_decision, v_user, nullif(trim(p_note), ''));

  update public.product_ideas
     set approval_status = p_decision,
         decided_by = v_user,
         decided_at = now(),
         decision_note = nullif(trim(p_note), '')
   where id = p_idea_id
  returning * into v_idea;

  return v_idea;
end;
$$;

revoke all on function public.decide_product_idea(uuid, public.approval_status, text) from public, anon;
grant execute on function public.decide_product_idea(uuid, public.approval_status, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Empresas e fontes
-- -----------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  normalized_name text not null,
  -- Identificador confiável para deduplicação (somente dígitos).
  cnpj text unique check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  segment text,
  website text check (website is null or website ~* '^https?://'),
  website_domain text,
  phone text,
  phone_normalized text,
  address text,
  neighborhood text,
  city text,
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{8}$'),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  location_status public.information_status not null default 'unknown',
  location_verified_at timestamptz,
  -- RN-12: natureza de cada campo, ex.: { "phone": { "status": "source_declared", "source": "..." } }
  field_provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(field_provenance) = 'object'),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_coordinates_complete check ((latitude is null) = (longitude is null)),
  constraint companies_verified_location check (
    location_status <> 'confirmed' or (latitude is not null and location_verified_at is not null)
  )
);

create index companies_normalized_name_idx on public.companies (normalized_name);
create index companies_website_domain_idx on public.companies (website_domain) where website_domain is not null;
create index companies_phone_idx on public.companies (phone_normalized) where phone_normalized is not null;
create index companies_segment_idx on public.companies (segment);

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create table public.company_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  research_session_id uuid references public.research_sessions (id),
  source_name text not null check (char_length(source_name) between 1 and 80),
  source_record_id text,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  collected_at timestamptz not null default now(),
  last_verified_at timestamptz,
  evidence_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index company_sources_record_idx
  on public.company_sources (source_name, source_record_id)
  where source_record_id is not null;
create index company_sources_company_idx on public.company_sources (company_id);

-- -----------------------------------------------------------------------------
-- Oportunidades, pontuações e atividades
-- -----------------------------------------------------------------------------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  product_idea_id uuid references public.product_ideas (id),
  research_session_id uuid references public.research_sessions (id),
  commercial_status text not null default 'nova' references public.commercial_statuses (key),
  -- "Salva" é diferente de "contatada" ou "convertida".
  is_saved boolean not null default false,
  saved_at timestamptz,
  -- Cópia da pontuação vigente para ordenação; o histórico fica em opportunity_scores.
  current_score_id uuid,
  score numeric(5, 2) check (score is null or score between 0 and 100),
  confidence numeric(5, 2) check (confidence is null or confidence between 0 and 100),
  score_version integer references public.scoring_configs (version),
  score_is_complete boolean,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_saved_consistency check (is_saved = (saved_at is not null))
);

create unique index opportunities_company_idea_idx
  on public.opportunities (company_id, product_idea_id) nulls not distinct;
create index opportunities_status_idx on public.opportunities (commercial_status);
create index opportunities_score_idx on public.opportunities (score desc nulls last);

create trigger opportunities_set_updated_at
before update on public.opportunities
for each row execute function public.set_updated_at();

-- Cada cálculo de pontuação é preservado (RN-11).
create table public.opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id),
  score_version integer not null references public.scoring_configs (version),
  score numeric(5, 2) not null check (score between 0 and 100),
  score_min numeric(5, 2) not null check (score_min between 0 and 100),
  score_max numeric(5, 2) not null check (score_max between 0 and 100),
  stars smallint not null check (stars between 1 and 5),
  confidence numeric(5, 2) not null check (confidence between 0 and 100),
  is_complete boolean not null,
  explanation jsonb not null,
  input_snapshot jsonb not null,
  computed_by uuid default auth.uid() references public.profiles (id),
  computed_at timestamptz not null default now(),
  constraint opportunity_scores_range check (score_min <= score and score <= score_max)
);

create index opportunity_scores_opportunity_idx on public.opportunity_scores (opportunity_id, computed_at desc);

alter table public.opportunities
  add constraint opportunities_current_score_fk
  foreign key (current_score_id) references public.opportunity_scores (id);

create table public.score_breakdowns (
  id uuid primary key default gen_random_uuid(),
  opportunity_score_id uuid not null references public.opportunity_scores (id),
  criterion text not null,
  weight numeric(6, 4) not null check (weight between 0 and 1),
  raw_score numeric(5, 2) check (raw_score is null or raw_score between 0 and 100),
  weighted_score numeric(6, 2),
  information_status public.information_status not null,
  evidence jsonb not null default '[]'::jsonb,
  missing_data jsonb not null default '[]'::jsonb,
  unique (opportunity_score_id, criterion)
);

create table public.commercial_activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id),
  user_id uuid not null default auth.uid() references public.profiles (id),
  activity_type public.activity_type not null,
  note text check (note is null or char_length(note) <= 5000),
  previous_status text references public.commercial_statuses (key),
  new_status text references public.commercial_statuses (key),
  created_at timestamptz not null default now(),
  constraint commercial_activities_status_change check (
    activity_type <> 'status_change' or (new_status is not null and previous_status is distinct from new_status)
  )
);

create index commercial_activities_opportunity_idx on public.commercial_activities (opportunity_id, created_at desc);
create index commercial_activities_created_at_idx on public.commercial_activities (created_at desc);

-- Mudança de status sempre acompanhada de registro no histórico (RN-11).
create or replace function public.change_opportunity_status(
  p_opportunity_id uuid,
  p_new_status text,
  p_note text default null
)
returns public.opportunities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opportunity public.opportunities;
  v_previous text;
begin
  if not private.is_active_member() then
    raise exception 'permissão insuficiente' using errcode = '42501';
  end if;
  if not exists (select 1 from public.commercial_statuses where key = p_new_status and is_active) then
    raise exception 'status comercial inválido' using errcode = '22023';
  end if;

  select commercial_status into v_previous
    from public.opportunities where id = p_opportunity_id for update;
  if not found then
    raise exception 'oportunidade não encontrada' using errcode = 'P0002';
  end if;
  if v_previous = p_new_status then
    raise exception 'a oportunidade já está neste status' using errcode = '22023';
  end if;

  update public.opportunities
     set commercial_status = p_new_status
   where id = p_opportunity_id
  returning * into v_opportunity;

  insert into public.commercial_activities (opportunity_id, user_id, activity_type, note, previous_status, new_status)
  values (p_opportunity_id, (select auth.uid()), 'status_change', nullif(trim(p_note), ''), v_previous, p_new_status);

  return v_opportunity;
end;
$$;

revoke all on function public.change_opportunity_status(uuid, text, text) from public, anon;
grant execute on function public.change_opportunity_status(uuid, text, text) to authenticated;

-- Salvar/remover dos salvos também fica registrado.
create or replace function public.set_opportunity_saved(
  p_opportunity_id uuid,
  p_saved boolean
)
returns public.opportunities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opportunity public.opportunities;
begin
  if not private.is_active_member() then
    raise exception 'permissão insuficiente' using errcode = '42501';
  end if;

  update public.opportunities
     set is_saved = p_saved,
         saved_at = case when p_saved then coalesce(saved_at, now()) else null end
   where id = p_opportunity_id and is_saved is distinct from p_saved
  returning * into v_opportunity;

  if not found then
    select * into v_opportunity from public.opportunities where id = p_opportunity_id;
    if not found then
      raise exception 'oportunidade não encontrada' using errcode = 'P0002';
    end if;
    return v_opportunity;
  end if;

  insert into public.commercial_activities (opportunity_id, user_id, activity_type)
  values (p_opportunity_id, (select auth.uid()), case when p_saved then 'saved' else 'unsaved' end::public.activity_type);

  return v_opportunity;
end;
$$;

revoke all on function public.set_opportunity_saved(uuid, boolean) from public, anon;
grant execute on function public.set_opportunity_saved(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Privilégios de tabela
-- O Supabase concede ALL às roles da API por padrão; aqui reduzimos ao mínimo.
-- ATENÇÃO: migrations futuras que criarem tabelas precisam repetir este
-- padrão (revogar de anon/authenticated e conceder só o necessário).
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on all tables in schema public to authenticated;

grant update (display_name) on public.profiles to authenticated;

grant insert, update on public.system_settings to authenticated;
grant insert on public.production_settings to authenticated;
grant insert on public.scoring_configs to authenticated;

grant insert on public.research_sessions to authenticated;
grant update (status, configuration_snapshot, started_at, completed_at, error_message, filters, objective)
  on public.research_sessions to authenticated;
grant insert, update (status, results_count, error_message, request_metadata, started_at, finished_at)
  on public.research_source_runs to authenticated;

-- Colunas de decisão só mudam via decide_product_idea().
grant insert (research_session_id, name, normalized_name, description, problem_statement, target_segment,
              proposed_application, expected_benefit, evidence, technical_constraints, missing_information,
              origin, ai_provider, ai_model, created_by)
  on public.product_ideas to authenticated;
grant update (description, problem_statement, target_segment, proposed_application, expected_benefit,
              technical_constraints, missing_information)
  on public.product_ideas to authenticated;

grant insert on public.companies to authenticated;
grant update (name, normalized_name, cnpj, segment, website, website_domain, phone, phone_normalized,
              address, neighborhood, city, state, postal_code, latitude, longitude, location_status,
              location_verified_at, field_provenance)
  on public.companies to authenticated;
grant insert, update (last_verified_at, evidence_metadata, source_url) on public.company_sources to authenticated;

-- Status comercial e "salva" só mudam via funções que registram histórico.
grant insert (company_id, product_idea_id, research_session_id, created_by) on public.opportunities to authenticated;
grant update (current_score_id, score, confidence, score_version, score_is_complete) on public.opportunities to authenticated;
grant insert on public.opportunity_scores to authenticated;
grant insert on public.score_breakdowns to authenticated;

-- Atividades manuais (notas, contatos); mudanças de status usam a função.
grant insert (opportunity_id, user_id, activity_type, note) on public.commercial_activities to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.system_settings enable row level security;
alter table public.system_settings_history enable row level security;
alter table public.production_settings enable row level security;
alter table public.scoring_configs enable row level security;
alter table public.commercial_statuses enable row level security;
alter table public.research_sessions enable row level security;
alter table public.research_source_runs enable row level security;
alter table public.product_ideas enable row level security;
alter table public.product_idea_decisions enable row level security;
alter table public.companies enable row level security;
alter table public.company_sources enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_scores enable row level security;
alter table public.score_breakdowns enable row level security;
alter table public.commercial_activities enable row level security;

-- Perfis: cada um vê o próprio (mesmo inativo, para a tela de acesso pendente);
-- membros ativos veem a equipe.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_active_member()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Leitura compartilhada pela equipe ativa.
create policy system_settings_select on public.system_settings for select to authenticated
  using ((select private.is_active_member()));
create policy system_settings_history_select on public.system_settings_history for select to authenticated
  using ((select private.is_active_member()));
create policy production_settings_select on public.production_settings for select to authenticated
  using ((select private.is_active_member()));
create policy scoring_configs_select on public.scoring_configs for select to authenticated
  using ((select private.is_active_member()));
create policy commercial_statuses_select on public.commercial_statuses for select to authenticated
  using ((select private.is_active_member()));
create policy research_sessions_select on public.research_sessions for select to authenticated
  using ((select private.is_active_member()));
create policy research_source_runs_select on public.research_source_runs for select to authenticated
  using ((select private.is_active_member()));
create policy product_ideas_select on public.product_ideas for select to authenticated
  using ((select private.is_active_member()));
create policy product_idea_decisions_select on public.product_idea_decisions for select to authenticated
  using ((select private.is_active_member()));
create policy companies_select on public.companies for select to authenticated
  using ((select private.is_active_member()));
create policy company_sources_select on public.company_sources for select to authenticated
  using ((select private.is_active_member()));
create policy opportunities_select on public.opportunities for select to authenticated
  using ((select private.is_active_member()));
create policy opportunity_scores_select on public.opportunity_scores for select to authenticated
  using ((select private.is_active_member()));
create policy score_breakdowns_select on public.score_breakdowns for select to authenticated
  using ((select private.is_active_member()));
create policy commercial_activities_select on public.commercial_activities for select to authenticated
  using ((select private.is_active_member()));

-- Configurações sensíveis: somente administradores alteram.
create policy system_settings_insert on public.system_settings for insert to authenticated
  with check ((select private.is_admin()));
create policy system_settings_update on public.system_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy scoring_configs_insert on public.scoring_configs for insert to authenticated
  with check ((select private.is_admin()) and created_by = (select auth.uid()) and not is_active);

-- Capacidade produtiva: qualquer membro ativo registra (Christian informa os limites).
create policy production_settings_insert on public.production_settings for insert to authenticated
  with check ((select private.is_active_member()) and created_by = (select auth.uid()));

-- Registros de trabalho: membros ativos criam em seu próprio nome.
create policy research_sessions_insert on public.research_sessions for insert to authenticated
  with check ((select private.is_active_member()) and created_by = (select auth.uid()));
create policy research_sessions_update on public.research_sessions for update to authenticated
  using ((select private.is_active_member())) with check ((select private.is_active_member()));

create policy research_source_runs_insert on public.research_source_runs for insert to authenticated
  with check ((select private.is_active_member()));
create policy research_source_runs_update on public.research_source_runs for update to authenticated
  using ((select private.is_active_member())) with check ((select private.is_active_member()));

create policy product_ideas_insert on public.product_ideas for insert to authenticated
  with check ((select private.is_active_member()) and created_by = (select auth.uid()));
create policy product_ideas_update on public.product_ideas for update to authenticated
  using ((select private.is_active_member())) with check ((select private.is_active_member()));

create policy companies_insert on public.companies for insert to authenticated
  with check ((select private.is_active_member()) and created_by = (select auth.uid()));
create policy companies_update on public.companies for update to authenticated
  using ((select private.is_active_member())) with check ((select private.is_active_member()));

create policy company_sources_insert on public.company_sources for insert to authenticated
  with check ((select private.is_active_member()));
create policy company_sources_update on public.company_sources for update to authenticated
  using ((select private.is_active_member())) with check ((select private.is_active_member()));

create policy opportunities_insert on public.opportunities for insert to authenticated
  with check ((select private.is_active_member()) and created_by = (select auth.uid()));
create policy opportunities_update on public.opportunities for update to authenticated
  using ((select private.is_active_member())) with check ((select private.is_active_member()));

create policy opportunity_scores_insert on public.opportunity_scores for insert to authenticated
  with check ((select private.is_active_member()) and computed_by = (select auth.uid()));
create policy score_breakdowns_insert on public.score_breakdowns for insert to authenticated
  with check ((select private.is_active_member()));

create policy commercial_activities_insert on public.commercial_activities for insert to authenticated
  with check (
    (select private.is_active_member())
    and user_id = (select auth.uid())
    and activity_type in ('note', 'contact')
  );

-- -----------------------------------------------------------------------------
-- Dados de referência
-- -----------------------------------------------------------------------------
-- Pesos PROPOSTOS no documento de especificação (seção 6). Ficam marcados como
-- 'proposal' até validação explícita do negócio.
insert into public.scoring_configs (version, config, approval_state, notes, is_active, created_by) values (
  1,
  '{
    "weights": { "product_fit": 0.30, "feasibility": 0.30, "proximity": 0.20, "commercial_potential": 0.20 },
    "starBands": [
      { "minScore": 0,  "stars": 1 },
      { "minScore": 20, "stars": 2 },
      { "minScore": 40, "stars": 3 },
      { "minScore": 60, "stars": 4 },
      { "minScore": 80, "stars": 5 }
    ],
    "qualificationMinScore": null,
    "missingDataStrategy": "normalize_known_with_range",
    "proximity": { "curve": "linear_within_radius", "unverifiedMaxScore": 75 },
    "proximityRequiresFit": { "minProductFitScore": 40 },
    "infeasibleScoreCap": 39,
    "confidence": {
      "statusFactors": { "confirmed": 1, "source_declared": 0.7, "ai_inference": 0.4, "outdated": 0.3, "unknown": 0 },
      "staleAfterDays": 180,
      "staleFactor": 0.5,
      "levels": { "lowBelow": 40, "highFrom": 70 }
    }
  }'::jsonb,
  'proposal',
  'Pesos e intervalos iniciais propostos para testes (seção 6 da especificação). Ainda não aprovados.',
  true,
  null
);
