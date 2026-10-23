-- =============================================================================
-- Etapa 5 — fluxo de prospecção
--   * research_session_results: o que cada pesquisa encontrou. Uma nova
--     execução cria outra pesquisa e não apaga resultados anteriores (4.3).
--   * ai_usage_log: cada chamada à IA, para aplicar o limite diário de uso e
--     mostrar falhas com clareza. Não guarda prompts nem respostas completas.
-- =============================================================================

create table public.research_session_results (
  id bigint generated always as identity primary key,
  research_session_id uuid not null references public.research_sessions (id),
  opportunity_id uuid not null references public.opportunities (id),
  company_id uuid not null references public.companies (id),
  product_idea_id uuid references public.product_ideas (id),
  source_name text not null check (char_length(source_name) between 1 and 80),
  -- Por que a empresa entrou no resultado (ex.: "segmento coincide").
  match_reason text not null check (char_length(match_reason) between 1 and 300),
  rank integer not null check (rank > 0),
  created_at timestamptz not null default now(),
  unique (research_session_id, opportunity_id)
);

create index research_session_results_session_idx on public.research_session_results (research_session_id, rank);

create table public.ai_usage_log (
  id bigint generated always as identity primary key,
  provider text not null check (char_length(provider) between 1 and 40),
  model text not null check (char_length(model) between 1 and 120),
  purpose text not null check (purpose in ('product_ideas')),
  research_session_id uuid references public.research_sessions (id),
  status text not null check (status in ('succeeded', 'failed', 'rejected_output')),
  error_code text check (error_code is null or char_length(error_code) <= 80),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index ai_usage_log_created_at_idx on public.ai_usage_log (created_at desc);

-- Privilégios mínimos (o padrão do Supabase concede ALL às roles da API).
revoke all on public.research_session_results from anon, authenticated;
revoke all on public.ai_usage_log from anon, authenticated;
grant select, insert on public.research_session_results to authenticated;
grant select, insert on public.ai_usage_log to authenticated;

alter table public.research_session_results enable row level security;
alter table public.ai_usage_log enable row level security;

create policy research_session_results_select on public.research_session_results for select to authenticated
  using ((select private.is_active_member()));
create policy research_session_results_insert on public.research_session_results for insert to authenticated
  with check ((select private.is_active_member()));

create policy ai_usage_log_select on public.ai_usage_log for select to authenticated
  using ((select private.is_active_member()));
create policy ai_usage_log_insert on public.ai_usage_log for insert to authenticated
  with check ((select private.is_active_member()) and created_by = (select auth.uid()));
