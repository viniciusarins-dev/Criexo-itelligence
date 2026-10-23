-- =============================================================================
-- Etapa 6 — fontes externas e pontuação automática
--   * ai_usage_log passa a registrar também a avaliação das oportunidades.
--   * research_session_results guarda se a empresa entrou nova no cadastro e
--     se coincide com uma já cadastrada (revisão humana; nada é unido).
-- =============================================================================

alter table public.ai_usage_log drop constraint ai_usage_log_purpose_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_purpose_check check (purpose in ('product_ideas', 'opportunity_assessment'));

alter table public.research_session_results
  add column is_new_company boolean not null default false,
  -- Link do registro na fonte quando ele parece ser uma empresa já cadastrada.
  add column possible_duplicate_url text
    check (possible_duplicate_url is null or possible_duplicate_url ~* '^https?://');
