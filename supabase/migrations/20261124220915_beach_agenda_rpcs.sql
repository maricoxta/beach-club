-- =============================================================================
-- Beach club: RPCs da agenda (ocupação de turmas, alunos da turma, lista de chamada)
--
-- Por que RPC: o professor não lê beach.matriculas (RLS), então não consegue
-- montar sozinho a lista de alunos ativos da turma. Estas funções são
-- SECURITY DEFINER, checam a permissão explicitamente e devolvem só o necessário.
-- =============================================================================

-- Vagas ocupadas por turma (matrículas ativas). Só números: liberado para
-- qualquer usuário logado (o aluno vê se a turma tem vaga).
create or replace function beach.turmas_ocupacao()
returns table (turma_id uuid, ocupadas integer)
language sql
stable
security definer
set search_path = ''
as $$
  select mt.turma_id, count(*)::integer
  from beach.matricula_turmas mt
  join beach.matriculas m on m.id = mt.matricula_id
  where m.status = 'ativa'
    and (select auth.uid()) is not null
  group by mt.turma_id
$$;
comment on function beach.turmas_ocupacao() is 'Vagas ocupadas (matrículas ativas) por turma.';

-- Alunos com matrícula ativa na turma. Staff ou o professor da turma.
create or replace function beach.alunos_da_turma(p_turma uuid)
returns table (aluno_id uuid, nome text, telefone text, data_inicio date)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (beach.is_staff() or beach.professor_da_turma(p_turma)) then
    raise exception 'Sem permissão para ver os alunos desta turma' using errcode = 'insufficient_privilege';
  end if;

  return query
  select p.id, p.nome, p.telefone, m.data_inicio
  from beach.matricula_turmas mt
  join beach.matriculas m on m.id = mt.matricula_id
  join beach.perfis p on p.id = m.aluno_id
  where mt.turma_id = p_turma
    and m.status = 'ativa'
  order by p.nome;
end;
$$;
comment on function beach.alunos_da_turma(uuid) is 'Alunos com matrícula ativa na turma (staff ou professor da turma).';

-- Lista de chamada de uma aula: alunos matriculados na turma na data da aula
-- + quem já tem presença lançada (reposição/experimental), com o status atual.
create or replace function beach.lista_chamada(p_aula uuid)
returns table (
  aluno_id    uuid,
  nome        text,
  matriculado boolean,
  presenca_id uuid,
  status      beach.status_presenca,
  observacao  text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_aula beach.aulas%rowtype;
begin
  if not (beach.is_staff() or beach.professor_da_aula(p_aula)) then
    raise exception 'Sem permissão para ver a chamada desta aula' using errcode = 'insufficient_privilege';
  end if;

  select * into v_aula from beach.aulas where id = p_aula;
  if not found then
    raise exception 'Aula não encontrada';
  end if;

  return query
  with matriculados as (
    select distinct m.aluno_id
    from beach.matricula_turmas mt
    join beach.matriculas m on m.id = mt.matricula_id
    where mt.turma_id = v_aula.turma_id
      and m.status = 'ativa'
      and m.data_inicio <= v_aula.data
      and (m.data_fim is null or m.data_fim >= v_aula.data)
  ),
  lancados as (
    select pr.id, pr.aluno_id, pr.status, pr.observacao
    from beach.presencas pr
    where pr.aula_id = p_aula
  ),
  todos as (
    select aluno_id from matriculados
    union
    select aluno_id from lancados
  )
  select t.aluno_id,
         p.nome,
         exists (select 1 from matriculados mm where mm.aluno_id = t.aluno_id),
         l.id,
         l.status,
         l.observacao
  from todos t
  join beach.perfis p on p.id = t.aluno_id
  left join lancados l on l.aluno_id = t.aluno_id
  order by p.nome;
end;
$$;
comment on function beach.lista_chamada(uuid) is 'Alunos esperados na aula + presenças já lançadas (staff ou professor da aula).';

revoke execute on function beach.turmas_ocupacao(), beach.alunos_da_turma(uuid), beach.lista_chamada(uuid) from public, anon;
grant execute on function beach.turmas_ocupacao(), beach.alunos_da_turma(uuid), beach.lista_chamada(uuid) to authenticated, service_role;
