-- =============================================================================
-- Beach club: criação de perfil no signup, proteção de papéis, grants e RLS
--
-- Visões por papel:
--   admin / recepcao -> tudo (recepção não mexe em admins nem apaga registros)
--   professor        -> próprias turmas/aulas, alunos delas, lança presença
--   aluno            -> próprios dados: matrículas, presenças, mensalidades, pagamentos, locações
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers de relacionamento (SECURITY DEFINER para evitar recursão de RLS)
-- -----------------------------------------------------------------------------
create or replace function beach.professor_da_turma(p_turma uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from beach.turmas t
    where t.id = p_turma and t.professor_id = (select auth.uid())
  )
$$;

create or replace function beach.professor_da_aula(p_aula uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from beach.aulas a
    join beach.turmas t on t.id = a.turma_id
    where a.id = p_aula
      and (select auth.uid()) in (a.professor_id, t.professor_id)
  )
$$;

create or replace function beach.aluno_da_turma(p_turma uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from beach.matricula_turmas mt
    join beach.matriculas m on m.id = mt.matricula_id
    where mt.turma_id = p_turma
      and m.aluno_id = (select auth.uid())
      and m.status = 'ativa'
  )
$$;

create or replace function beach.minha_matricula(p_matricula uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from beach.matriculas m
    where m.id = p_matricula and m.aluno_id = (select auth.uid())
  )
$$;

-- Professor enxerga alunos matriculados nas suas turmas ou presentes nas suas aulas (reposição).
create or replace function beach.professor_tem_aluno(p_aluno uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from beach.matricula_turmas mt
    join beach.matriculas m on m.id = mt.matricula_id
    join beach.turmas t on t.id = mt.turma_id
    where m.aluno_id = p_aluno
      and m.status = 'ativa'
      and t.professor_id = (select auth.uid())
  ) or exists (
    select 1
    from beach.presencas pr
    join beach.aulas a on a.id = pr.aula_id
    where pr.aluno_id = p_aluno
      and a.professor_id = (select auth.uid())
  )
$$;

-- -----------------------------------------------------------------------------
-- Signup: cria o perfil (sempre como aluno) só para cadastros vindos do app do
-- beach club. O auth.users é compartilhado com outros apps deste projeto, então
-- o app precisa enviar options.data.app = 'beach-club' no signUp.
-- -----------------------------------------------------------------------------
create or replace function beach.tg_auth_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'app', '') = 'beach-club' then
    insert into beach.perfis (id, papel, nome, email, telefone)
    values (
      new.id,
      'aluno',
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1), 'Aluno'),
      new.email,
      nullif(trim(new.raw_user_meta_data ->> 'telefone'), '')
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger beach_novo_usuario
  after insert on auth.users
  for each row execute function beach.tg_auth_novo_usuario();

-- -----------------------------------------------------------------------------
-- Proteção de papel/ativo: ninguém se promove; recepção não cria nem altera admins.
-- -----------------------------------------------------------------------------
create or replace function beach.tg_perfis_protege_papel()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sistema boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
                       or session_user in ('postgres', 'supabase_auth_admin');
begin
  if v_sistema then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.papel = 'admin' and not beach.is_admin() then
      raise exception 'Apenas admin pode criar outro admin' using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if new.papel is distinct from old.papel or new.ativo is distinct from old.ativo then
    if not beach.is_staff() then
      raise exception 'Você não pode alterar papel ou status do perfil' using errcode = 'insufficient_privilege';
    end if;
    if (new.papel = 'admin' or old.papel = 'admin') and not beach.is_admin() then
      raise exception 'Apenas admin pode alterar perfis de admin' using errcode = 'insufficient_privilege';
    end if;
  end if;

  if new.id is distinct from old.id then
    raise exception 'O id do perfil não pode ser alterado';
  end if;

  return new;
end;
$$;
create trigger perfis_protege_papel before insert or update on beach.perfis
  for each row execute function beach.tg_perfis_protege_papel();

-- -----------------------------------------------------------------------------
-- Grants: nada para anon; authenticated acessa via RLS; service_role total.
-- -----------------------------------------------------------------------------
revoke all on schema beach from public, anon;
grant usage on schema beach to authenticated, service_role;

revoke all on all tables in schema beach from public, anon;
grant select, insert, update, delete on all tables in schema beach to authenticated;
revoke insert, update, delete on beach.vw_mensalidades, beach.vw_inadimplencia, beach.vw_relatorio_mensal from authenticated;
grant all on all tables in schema beach to service_role;

revoke all on all sequences in schema beach from public, anon;
grant usage, select on all sequences in schema beach to authenticated, service_role;

revoke execute on all functions in schema beach from public, anon;
grant execute on all functions in schema beach to authenticated, service_role;
-- Função de trigger do auth: só o próprio trigger a chama.
revoke execute on function beach.tg_auth_novo_usuario() from authenticated;

alter default privileges in schema beach revoke execute on functions from public;
alter default privileges in schema beach grant execute on functions to authenticated, service_role;
alter default privileges in schema beach grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema beach grant all on tables to service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- Obs.: funções envolvidas em (select ...) são avaliadas uma vez por consulta.
-- -----------------------------------------------------------------------------
alter table beach.perfis           enable row level security;
alter table beach.modalidades      enable row level security;
alter table beach.niveis           enable row level security;
alter table beach.quadras          enable row level security;
alter table beach.planos           enable row level security;
alter table beach.turmas           enable row level security;
alter table beach.aulas            enable row level security;
alter table beach.matriculas       enable row level security;
alter table beach.matricula_turmas enable row level security;
alter table beach.presencas        enable row level security;
alter table beach.mensalidades     enable row level security;
alter table beach.pagamentos       enable row level security;
alter table beach.locacoes         enable row level security;

-- ---------- perfis ----------
create policy perfis_select on beach.perfis for select to authenticated
  using (
    id = (select auth.uid())
    or (select beach.is_staff())
    or papel = 'professor'                -- nome do professor aparece nas turmas
    or beach.professor_tem_aluno(id)
  );
create policy perfis_insert on beach.perfis for insert to authenticated
  with check ((select beach.is_staff()));
create policy perfis_update on beach.perfis for update to authenticated
  using (id = (select auth.uid()) or (select beach.is_staff()))
  with check (id = (select auth.uid()) or (select beach.is_staff()));
create policy perfis_delete on beach.perfis for delete to authenticated
  using ((select beach.is_admin()));

-- ---------- cadastros de referência: todos leem, staff escreve, admin apaga ----------
create policy modalidades_select on beach.modalidades for select to authenticated using (true);
create policy modalidades_insert on beach.modalidades for insert to authenticated with check ((select beach.is_staff()));
create policy modalidades_update on beach.modalidades for update to authenticated using ((select beach.is_staff())) with check ((select beach.is_staff()));
create policy modalidades_delete on beach.modalidades for delete to authenticated using ((select beach.is_admin()));

create policy niveis_select on beach.niveis for select to authenticated using (true);
create policy niveis_insert on beach.niveis for insert to authenticated with check ((select beach.is_staff()));
create policy niveis_update on beach.niveis for update to authenticated using ((select beach.is_staff())) with check ((select beach.is_staff()));
create policy niveis_delete on beach.niveis for delete to authenticated using ((select beach.is_admin()));

create policy quadras_select on beach.quadras for select to authenticated using (true);
create policy quadras_insert on beach.quadras for insert to authenticated with check ((select beach.is_staff()));
create policy quadras_update on beach.quadras for update to authenticated using ((select beach.is_staff())) with check ((select beach.is_staff()));
create policy quadras_delete on beach.quadras for delete to authenticated using ((select beach.is_admin()));

create policy planos_select on beach.planos for select to authenticated using (true);
create policy planos_insert on beach.planos for insert to authenticated with check ((select beach.is_staff()));
create policy planos_update on beach.planos for update to authenticated using ((select beach.is_staff())) with check ((select beach.is_staff()));
create policy planos_delete on beach.planos for delete to authenticated using ((select beach.is_admin()));

create policy turmas_select on beach.turmas for select to authenticated using (true);
create policy turmas_insert on beach.turmas for insert to authenticated with check ((select beach.is_staff()));
create policy turmas_update on beach.turmas for update to authenticated using ((select beach.is_staff())) with check ((select beach.is_staff()));
create policy turmas_delete on beach.turmas for delete to authenticated using ((select beach.is_admin()));

-- ---------- aulas ----------
create policy aulas_select on beach.aulas for select to authenticated
  using (
    (select beach.is_staff())
    or professor_id = (select auth.uid())
    or beach.professor_da_turma(turma_id)
    or beach.aluno_da_turma(turma_id)
  );
create policy aulas_insert on beach.aulas for insert to authenticated
  with check ((select beach.is_staff()) or beach.professor_da_turma(turma_id));
create policy aulas_update on beach.aulas for update to authenticated
  using ((select beach.is_staff()) or professor_id = (select auth.uid()) or beach.professor_da_turma(turma_id))
  with check ((select beach.is_staff()) or beach.professor_da_turma(turma_id));
create policy aulas_delete on beach.aulas for delete to authenticated
  using ((select beach.is_staff()));

-- ---------- matrículas ----------
create policy matriculas_select on beach.matriculas for select to authenticated
  using ((select beach.is_staff()) or aluno_id = (select auth.uid()));
create policy matriculas_insert on beach.matriculas for insert to authenticated
  with check ((select beach.is_staff()));
create policy matriculas_update on beach.matriculas for update to authenticated
  using ((select beach.is_staff())) with check ((select beach.is_staff()));
create policy matriculas_delete on beach.matriculas for delete to authenticated
  using ((select beach.is_admin()));

create policy matricula_turmas_select on beach.matricula_turmas for select to authenticated
  using (
    (select beach.is_staff())
    or beach.professor_da_turma(turma_id)
    or beach.minha_matricula(matricula_id)
  );
create policy matricula_turmas_insert on beach.matricula_turmas for insert to authenticated
  with check ((select beach.is_staff()));
create policy matricula_turmas_delete on beach.matricula_turmas for delete to authenticated
  using ((select beach.is_staff()));

-- ---------- presenças ----------
create policy presencas_select on beach.presencas for select to authenticated
  using (
    (select beach.is_staff())
    or aluno_id = (select auth.uid())
    or beach.professor_da_aula(aula_id)
  );
create policy presencas_insert on beach.presencas for insert to authenticated
  with check ((select beach.is_staff()) or beach.professor_da_aula(aula_id));
create policy presencas_update on beach.presencas for update to authenticated
  using ((select beach.is_staff()) or beach.professor_da_aula(aula_id))
  with check ((select beach.is_staff()) or beach.professor_da_aula(aula_id));
create policy presencas_delete on beach.presencas for delete to authenticated
  using ((select beach.is_staff()) or beach.professor_da_aula(aula_id));

-- ---------- financeiro ----------
create policy mensalidades_select on beach.mensalidades for select to authenticated
  using ((select beach.is_staff()) or aluno_id = (select auth.uid()));
create policy mensalidades_insert on beach.mensalidades for insert to authenticated
  with check ((select beach.is_staff()));
create policy mensalidades_update on beach.mensalidades for update to authenticated
  using ((select beach.is_staff())) with check ((select beach.is_staff()));
create policy mensalidades_delete on beach.mensalidades for delete to authenticated
  using ((select beach.is_admin()));

create policy pagamentos_select on beach.pagamentos for select to authenticated
  using (
    (select beach.is_staff())
    or exists (select 1 from beach.mensalidades m where m.id = mensalidade_id and m.aluno_id = (select auth.uid()))
    or exists (select 1 from beach.locacoes l where l.id = locacao_id and l.cliente_id = (select auth.uid()))
  );
create policy pagamentos_insert on beach.pagamentos for insert to authenticated
  with check ((select beach.is_staff()));
create policy pagamentos_update on beach.pagamentos for update to authenticated
  using ((select beach.is_admin())) with check ((select beach.is_admin()));
create policy pagamentos_delete on beach.pagamentos for delete to authenticated
  using ((select beach.is_admin()));

-- ---------- locações ----------
create policy locacoes_select on beach.locacoes for select to authenticated
  using ((select beach.is_staff()) or cliente_id = (select auth.uid()));
create policy locacoes_insert on beach.locacoes for insert to authenticated
  with check ((select beach.is_staff()));
create policy locacoes_update on beach.locacoes for update to authenticated
  using ((select beach.is_staff())) with check ((select beach.is_staff()));
create policy locacoes_delete on beach.locacoes for delete to authenticated
  using ((select beach.is_admin()));
