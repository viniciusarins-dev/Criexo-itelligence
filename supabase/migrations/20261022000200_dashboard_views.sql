-- Agregações do dashboard. `security_invoker` garante que as políticas RLS
-- das tabelas de origem valem para quem consulta a view.

create view public.opportunity_status_counts
with (security_invoker = true)
as
select
  s.key as commercial_status,
  s.label,
  s.position,
  s.category,
  count(o.id)::integer as total
from public.commercial_statuses s
left join public.opportunities o on o.commercial_status = s.key
where s.is_active
group by s.key, s.label, s.position, s.category;

revoke all on public.opportunity_status_counts from anon, authenticated;
grant select on public.opportunity_status_counts to authenticated;
