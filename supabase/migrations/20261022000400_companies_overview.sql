-- =============================================================================
-- Etapa 3 — empresas
--   * CNPJ alfanumérico (novos cadastros desde julho de 2026): os 12 primeiros
--     caracteres podem ter letras maiúsculas; os 2 verificadores são números.
--   * View company_overview para a lista de empresas: distância até o ponto de
--     referência, melhor oportunidade e última verificação. `security_invoker`
--     mantém as políticas RLS das tabelas de origem.
-- =============================================================================

alter table public.companies drop constraint companies_cnpj_check;
alter table public.companies
  add constraint companies_cnpj_check check (cnpj is null or cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$');

create index companies_city_idx on public.companies (city);
create index companies_updated_at_idx on public.companies (updated_at desc);

create view public.company_overview
with (security_invoker = true)
as
with reference as (
  select
    (value ->> 'latitude')::double precision as latitude,
    (value ->> 'longitude')::double precision as longitude
  from public.system_settings
  where key = 'geo.reference'
)
select
  c.id,
  c.name,
  c.normalized_name,
  c.cnpj,
  c.segment,
  c.website,
  c.phone,
  c.neighborhood,
  c.city,
  c.state,
  c.latitude,
  c.longitude,
  c.location_status,
  c.created_at,
  c.updated_at,
  -- Distância em linha reta (Haversine, mesmo raio terrestre do domínio).
  -- Nula quando falta a localização da empresa ou o ponto de referência.
  case
    when c.latitude is not null and r.latitude is not null then
      round((2 * 6371.0088 * asin(least(1, sqrt(
        power(sin(radians(c.latitude - r.latitude) / 2), 2)
        + cos(radians(r.latitude)) * cos(radians(c.latitude))
          * power(sin(radians(c.longitude - r.longitude) / 2), 2)
      ))))::numeric, 2)
  end as distance_km,
  best.id as best_opportunity_id,
  best.score,
  best.confidence,
  best.commercial_status,
  best.product_name,
  coalesce(opportunity_totals.total, 0) as opportunity_count,
  greatest(sources.last_verified_at, c.location_verified_at) as last_verified_at,
  coalesce(sources.total, 0) as source_count
from public.companies c
left join reference r on true
left join lateral (
  select o.id, o.score, o.confidence, o.commercial_status, pi.name as product_name
    from public.opportunities o
    left join public.product_ideas pi on pi.id = o.product_idea_id
   where o.company_id = c.id
   order by o.score desc nulls last, o.updated_at desc
   limit 1
) best on true
left join lateral (
  select count(*)::integer as total from public.opportunities o where o.company_id = c.id
) opportunity_totals on true
left join lateral (
  select max(coalesce(s.last_verified_at, s.collected_at)) as last_verified_at, count(*)::integer as total
    from public.company_sources s
   where s.company_id = c.id
) sources on true;

revoke all on public.company_overview from anon, authenticated;
grant select on public.company_overview to authenticated;
