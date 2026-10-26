-- =============================================================================
-- Recomeçar os acessos com o "primeiro acesso" (uso único, no SQL Editor)
--
-- Antes: aplique a migration 20261026000900_first_access.sql.
-- O que faz:
--   1. Copia para a lista de liberados os e-mails que já estão cadastrados,
--      como administradores (DP-13: Christian e Vinicius são administradores).
--   2. Apaga esses usuários. O perfil vai junto e o e-mail volta a "não usado",
--      para cada um criar a senha em /primeiro-acesso.
-- Rode um bloco de cada vez e confira o resultado antes do próximo.
-- =============================================================================

-- 1. Lista de liberados a partir dos usuários atuais
insert into public.authorized_emails (email, role, display_name)
select lower(trim(u.email)), 'admin', p.display_name
from auth.users u
left join public.profiles p on p.id = u.id
where u.email is not null
on conflict (email) do nothing;

-- Conferência: devem aparecer os dois e-mails, com role = admin
select email, role, display_name, claimed_at from public.authorized_emails order by email;

-- 2. Apagar os usuários (só os que estão na lista)
delete from auth.users
where lower(trim(email)) in (select email from public.authorized_emails);

-- Conferência: auth.users vazio e claimed_at vazio nos dois e-mails
select count(*) as usuarios_restantes from auth.users;
select email, claimed_at from public.authorized_emails order by email;

-- Para liberar mais alguém no futuro:
-- insert into public.authorized_emails (email, role, display_name) values ('email@exemplo.com', 'member', 'Nome');
