-- =============================================================================
-- Perfis protegidos (2026-11-27)
--
-- Admin e recepção podem alterar qualquer perfil (policy perfis_update) e admin
-- pode apagar qualquer perfil (perfis_delete). Com contas de demonstração com
-- papel admin, isso permitiria rebaixar ou apagar a conta da dona do sistema.
--
-- Perfis listados em beach.perfis_protegidos só podem ser alterados ou apagados
-- pela própria pessoa (ou pelo sistema: service role / SQL editor).
-- Quem entra na lista é decidido fora do app, direto no banco:
--   insert into beach.perfis_protegidos (id) values ('<uuid do perfil>');
-- =============================================================================

create table if not exists beach.perfis_protegidos (
  id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

comment on table beach.perfis_protegidos is
  'Perfis que só a própria pessoa (ou o sistema) pode alterar ou apagar.';

-- Ninguém do app lê ou escreve na lista: RLS ligado, sem policies, sem grants.
alter table beach.perfis_protegidos enable row level security;
revoke all on beach.perfis_protegidos from anon, authenticated;

create or replace function beach.tg_perfis_protegidos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sistema boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
                       or session_user in ('postgres', 'supabase_auth_admin');
begin
  if not v_sistema
     and old.id is distinct from (select auth.uid())
     and exists (select 1 from beach.perfis_protegidos p where p.id = old.id) then
    raise exception 'Este perfil é protegido: só a própria pessoa pode alterá-lo ou excluí-lo'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function beach.tg_perfis_protegidos() from public, anon, authenticated;

drop trigger if exists perfis_protegidos on beach.perfis;
create trigger perfis_protegidos
  before update or delete on beach.perfis
  for each row execute function beach.tg_perfis_protegidos();
