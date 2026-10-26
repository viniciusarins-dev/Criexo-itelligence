-- =============================================================================
-- Primeiro acesso por e-mail liberado
--   * authorized_emails: e-mails que podem criar a própria senha, com o papel
--     que receberão. Só administradores (ou o SQL Editor) mantêm a lista.
--   * Ninguém fora da lista consegue criar conta: a trava é no próprio banco,
--     antes de o Supabase Auth gravar o usuário.
--   * Um e-mail da lista vira conta uma única vez (claimed_at) e já nasce
--     liberado, com o papel definido na lista.
-- =============================================================================

create table public.authorized_emails (
  email text primary key
    check (email = lower(trim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role public.app_role not null default 'member',
  display_name text check (display_name is null or char_length(trim(display_name)) between 1 and 120),
  -- Preenchido quando a conta é criada; impede um segundo cadastro com o mesmo e-mail.
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

revoke all on public.authorized_emails from anon, authenticated;
grant select on public.authorized_emails to authenticated;
alter table public.authorized_emails enable row level security;
create policy authorized_emails_select on public.authorized_emails for select to authenticated
  using ((select private.is_admin()));

-- Trava: o Supabase Auth só grava usuários de e-mails liberados e ainda não usados.
create or replace function private.guard_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.authorized_emails a
    where a.email = lower(trim(new.email)) and a.claimed_at is null
  ) then
    raise exception 'e-mail não liberado para acesso' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger before_auth_user_created
before insert on auth.users
for each row execute function private.guard_new_user();

-- O perfil nasce liberado, com o papel e o nome da lista; o e-mail fica marcado como usado.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_authorized public.authorized_emails;
begin
  update public.authorized_emails
     set claimed_at = now()
   where email = lower(trim(new.email)) and claimed_at is null
  returning * into v_authorized;

  insert into public.profiles (id, display_name, role, is_active)
  values (
    new.id,
    coalesce(
      nullif(trim(v_authorized.display_name), ''),
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'usuario'), '@', 1)
    ),
    coalesce(v_authorized.role, 'member'),
    v_authorized.email is not null
  );
  return new;
end;
$$;

-- Excluir um usuário devolve o e-mail à lista como "não usado", para um novo primeiro acesso.
create or replace function private.release_authorized_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.authorized_emails set claimed_at = null where email = lower(trim(old.email));
  return old;
end;
$$;

create trigger on_auth_user_deleted
after delete on auth.users
for each row execute function private.release_authorized_email();
