-- =============================================================================
-- Etapa 8 — revisão de segurança
--   * set_updated_at() só é usada por gatilhos: ninguém precisa executá-la
--     diretamente pela API.
-- =============================================================================
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- =============================================================================
-- Desempenho: índices para as consultas feitas pelo aplicativo
-- =============================================================================
-- Produtos e ideias (contagem e lista de oportunidades por ideia).
create index opportunities_product_idea_idx on public.opportunities (product_idea_id) where product_idea_id is not null;
-- Relatórios e exportação filtram por data de criação.
create index opportunities_created_at_idx on public.opportunities (created_at desc);
create index companies_created_at_idx on public.companies (created_at desc);
-- Novas execuções de uma pesquisa.
create index research_sessions_rerun_idx on public.research_sessions (rerun_of) where rerun_of is not null;
-- Limite diário por fonte (OpenStreetMap).
create index research_source_runs_source_started_idx on public.research_source_runs (source_name, started_at desc);
-- Resultados por empresa/oportunidade e revisões por empresa.
create index research_session_results_company_idx on public.research_session_results (company_id);
create index research_session_results_opportunity_idx on public.research_session_results (opportunity_id);
create index duplicate_reviews_company_idx on public.duplicate_reviews (company_id);
