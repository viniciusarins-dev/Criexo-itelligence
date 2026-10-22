-- =============================================================================
-- Etapa 2 — configurações
--   * Validação, no banco, das chaves conhecidas de system_settings.
--   * Estrutura mínima de production_settings.
--   * Pontuação v2: pesos e regras da v1 aprovados por Christian Drager em
--     22/10/2026 (DP-04 a DP-12), com nota mínima de qualificação 60 (DP-06).
--   * Listagem da equipe com e-mail, apenas para administradores.
-- =============================================================================

-- Somente chaves conhecidas são aceitas; cada uma com seu formato.
-- O coalesce é essencial: um CHECK que resulta em NULL (campo ausente) passaria.
create or replace function private.is_valid_system_setting(p_key text, p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case p_key
    -- Ponto de referência: endereço + coordenadas informadas por uma pessoa.
    when 'geo.reference' then
      jsonb_typeof(p_value) = 'object'
      and jsonb_typeof(p_value -> 'address') = 'string'
      and char_length(trim(p_value ->> 'address')) between 3 and 200
      and jsonb_typeof(p_value -> 'latitude') = 'number'
      and jsonb_typeof(p_value -> 'longitude') = 'number'
      and (p_value ->> 'latitude')::numeric between -90 and 90
      and (p_value ->> 'longitude')::numeric between -180 and 180
    when 'geo.radius_km' then
      jsonb_typeof(p_value) = 'number'
      and (p_value #>> '{}')::numeric > 0
      and (p_value #>> '{}')::numeric <= 100
    else false
  end, false);
$$;

-- A constraint executa a função com o papel de quem grava.
revoke all on function private.is_valid_system_setting(text, jsonb) from public;
grant execute on function private.is_valid_system_setting(text, jsonb) to authenticated;

alter table public.system_settings
  add constraint system_settings_valid_value
  check (private.is_valid_system_setting(key, value));

alter table public.production_settings
  add constraint production_settings_schema_version
  check (coalesce(settings ->> 'schemaVersion', '') = '1');

-- Pontuação v2 (aprovada). A v1 permanece como registro histórico.
insert into public.scoring_configs (version, config, approval_state, notes, is_active, created_by)
select
  2,
  jsonb_set(config, '{qualificationMinScore}', '60'::jsonb),
  'approved',
  'Pesos, estrelas e regras da v1 aprovados por Christian Drager em 22/10/2026 (DP-04 a DP-12). Nota mínima de qualificação: 60 (DP-06).',
  false,
  null
from public.scoring_configs
where version = 1;

update public.scoring_configs set is_active = false where version = 1;
update public.scoring_configs set is_active = true where version = 2;

-- Equipe com e-mail (o e-mail fica em auth.users, fora do alcance da API).
create or replace function public.admin_list_members()
returns table (
  id uuid,
  email text,
  display_name text,
  role public.app_role,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'permissão insuficiente' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.display_name, p.role, p.is_active, p.created_at
      from public.profiles p
      join auth.users u on u.id = p.id
     order by p.is_active desc, p.display_name;
end;
$$;

revoke all on function public.admin_list_members() from public, anon;
grant execute on function public.admin_list_members() to authenticated;
