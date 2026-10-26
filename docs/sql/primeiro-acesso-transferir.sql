-- =============================================================================
-- Primeiro acesso SEM perder dados (uso único, no SQL Editor)
--
-- Use quando os usuários antigos já criaram registros (empresas, pesquisas,
-- configurações) e o "delete from auth.users" falha com erro de chave
-- estrangeira (23503). Em vez de apagar, o usuário antigo é renomeado, a
-- pessoa faz o primeiro acesso com o e-mail de sempre e os registros passam
-- para a conta nova.
--
-- Antes: migration 20261026000900_first_access.sql aplicada e os e-mails na
-- lista (bloco 1 de primeiro-acesso-recomecar.sql).
-- Rode um passo de cada vez e confira o resultado antes do próximo.
-- =============================================================================

-- PASSO 1: renomear os usuários antigos (libera o e-mail para o primeiro acesso)
update auth.users
   set email = 'antigo.' || lower(trim(email))
 where lower(trim(email)) in (select email from public.authorized_emails)
   and email not like 'antigo.%';

update auth.identities i
   set identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(u.email))
  from auth.users u
 where i.user_id = u.id and u.email like 'antigo.%' and i.provider = 'email';

update public.authorized_emails set claimed_at = null;

select email from auth.users order by email;
select email, claimed_at from public.authorized_emails order by email;

-- PASSO 2 (fora do SQL Editor): cada pessoa abre /primeiro-acesso, informa o
-- e-mail de sempre e cria a senha. Quem não fizer agora fica para depois: o
-- passo 3 só mexe em quem já tem a conta nova.

-- PASSO 3: transferir tudo do usuário antigo para o novo e apagar o antigo
begin;

create temp table troca on commit drop as
select velho.id as velho, novo.id as novo
  from auth.users velho
  join auth.users novo on lower(novo.email) = substr(lower(velho.email), 8)
 where velho.email like 'antigo.%';

update public.system_settings_history t set changed_by = x.novo from troca x where t.changed_by = x.velho;
update public.system_settings         t set updated_by = x.novo from troca x where t.updated_by = x.velho;
update public.production_settings     t set created_by = x.novo from troca x where t.created_by = x.velho;
update public.scoring_configs         t set created_by = x.novo from troca x where t.created_by = x.velho;
update public.research_sessions       t set created_by = x.novo from troca x where t.created_by = x.velho;
update public.product_ideas           t set created_by = x.novo from troca x where t.created_by = x.velho;
update public.product_ideas           t set decided_by = x.novo from troca x where t.decided_by = x.velho;
update public.product_idea_decisions  t set decided_by = x.novo from troca x where t.decided_by = x.velho;
update public.companies               t set created_by = x.novo from troca x where t.created_by = x.velho;
update public.opportunities           t set created_by = x.novo from troca x where t.created_by = x.velho;
update public.opportunity_scores      t set computed_by = x.novo from troca x where t.computed_by = x.velho;
update public.commercial_activities   t set user_id = x.novo from troca x where t.user_id = x.velho;
update public.ai_usage_log            t set created_by = x.novo from troca x where t.created_by = x.velho;
update public.duplicate_reviews       t set created_by = x.novo from troca x where t.created_by = x.velho;
update public.duplicate_reviews       t set decided_by = x.novo from troca x where t.decided_by = x.velho;

delete from auth.users where id in (select velho from troca);

commit;

select email from auth.users order by email;
