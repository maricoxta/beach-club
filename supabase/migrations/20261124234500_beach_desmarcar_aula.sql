-- =============================================================================
-- Beach club: aluno desmarca (e remarca) uma aula, liberando a vaga daquela data
--
-- Regras:
--   - Só o próprio aluno, com matrícula ativa na turma na data da aula.
--   - Só aula "agendada" e até 2 horas antes do início (horário de São Paulo).
--   - Desmarcar = presença "falta_justificada" com observação fixa; a vaga daquela
--     aula fica livre para reposição/avulso (ver beach.vagas_livres_aula).
--   - Remarcar desfaz a desmarcação, se ainda houver vaga.
-- O aluno não escreve em beach.presencas pelo RLS, por isso as RPCs.
-- =============================================================================

create or replace function beach.inicio_aula(p_aula uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select (a.data + t.hora_inicio) at time zone 'America/Sao_Paulo'
  from beach.aulas a join beach.turmas t on t.id = a.turma_id
  where a.id = p_aula
$$;
comment on function beach.inicio_aula(uuid) is 'Início da aula como timestamptz (data + hora da turma no fuso de São Paulo).';

-- Vagas livres numa aula: vagas da turma - matriculados ativos na data
-- + matriculados que desmarcaram - avulsos/reposições lançados.
create or replace function beach.vagas_livres_aula(p_aula uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_aula  beach.aulas%rowtype;
  v_vagas smallint;
  v_resultado integer;
begin
  select * into v_aula from beach.aulas where id = p_aula;
  if not found then
    return null;
  end if;
  if not (beach.is_staff() or beach.professor_da_aula(p_aula) or beach.aluno_da_turma(v_aula.turma_id)) then
    raise exception 'Sem permissão para ver esta aula' using errcode = 'insufficient_privilege';
  end if;
  select vagas into v_vagas from beach.turmas where id = v_aula.turma_id;

  with matriculados as (
    select distinct m.aluno_id
    from beach.matricula_turmas mt
    join beach.matriculas m on m.id = mt.matricula_id
    where mt.turma_id = v_aula.turma_id
      and m.status = 'ativa'
      and m.data_inicio <= v_aula.data
      and (m.data_fim is null or m.data_fim >= v_aula.data)
  )
  select v_vagas
       - (select count(*) from matriculados)
       + (select count(*) from beach.presencas pr
          where pr.aula_id = p_aula and pr.status = 'falta_justificada'
            and pr.observacao = 'Desmarcada pelo aluno'
            and pr.aluno_id in (select aluno_id from matriculados))
       - (select count(*) from beach.presencas pr
          where pr.aula_id = p_aula and pr.aluno_id not in (select aluno_id from matriculados))
  into v_resultado;
  return greatest(v_resultado, 0);
end;
$$;
comment on function beach.vagas_livres_aula(uuid) is 'Vagas livres numa aula específica (considera desmarcações e reposições).';

-- Checagens comuns de desmarcar/remarcar. Devolve a aula.
create or replace function beach.validar_desmarcacao(p_aula uuid)
returns beach.aulas
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_aula beach.aulas%rowtype;
begin
  select * into v_aula from beach.aulas where id = p_aula;
  if not found then
    raise exception 'Aula não encontrada';
  end if;
  if not exists (
    select 1
    from beach.matricula_turmas mt
    join beach.matriculas m on m.id = mt.matricula_id
    where mt.turma_id = v_aula.turma_id
      and m.aluno_id = (select auth.uid())
      and m.status = 'ativa'
      and m.data_inicio <= v_aula.data
      and (m.data_fim is null or m.data_fim >= v_aula.data)
  ) then
    raise exception 'Você não está matriculado nesta turma' using errcode = 'insufficient_privilege';
  end if;
  if v_aula.status <> 'agendada' then
    raise exception 'Esta aula não está mais agendada' using errcode = 'check_violation';
  end if;
  if now() > beach.inicio_aula(p_aula) - interval '2 hours' then
    raise exception 'Só é possível desmarcar ou remarcar até 2 horas antes da aula' using errcode = 'check_violation';
  end if;
  return v_aula;
end;
$$;

create or replace function beach.desmarcar_aula(p_aula uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_existente beach.presencas%rowtype;
begin
  perform beach.validar_desmarcacao(p_aula);

  select * into v_existente from beach.presencas where aula_id = p_aula and aluno_id = (select auth.uid());
  if found and v_existente.observacao is distinct from 'Desmarcada pelo aluno' then
    raise exception 'A presença desta aula já foi lançada pela recepção' using errcode = 'check_violation';
  end if;

  insert into beach.presencas (aula_id, aluno_id, status, registrado_por, observacao)
  values (p_aula, (select auth.uid()), 'falta_justificada', (select auth.uid()), 'Desmarcada pelo aluno')
  on conflict (aula_id, aluno_id) do nothing;
end;
$$;
comment on function beach.desmarcar_aula(uuid) is 'Aluno desmarca a própria aula (até 2h antes), liberando a vaga.';

create or replace function beach.remarcar_aula(p_aula uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform beach.validar_desmarcacao(p_aula);
  -- Trava a turma para não disputar a mesma vaga com uma reposição.
  perform 1 from beach.turmas t join beach.aulas a on a.turma_id = t.id where a.id = p_aula for update of t;

  if not exists (
    select 1 from beach.presencas
    where aula_id = p_aula and aluno_id = (select auth.uid()) and observacao = 'Desmarcada pelo aluno'
  ) then
    return;  -- nada para desfazer
  end if;
  -- A própria desmarcação conta como 1 vaga livre; se ela foi ocupada, não há vaga.
  if beach.vagas_livres_aula(p_aula) < 1 then
    raise exception 'A vaga já foi ocupada por outro aluno. Fale com a recepção.' using errcode = 'check_violation';
  end if;

  delete from beach.presencas
  where aula_id = p_aula and aluno_id = (select auth.uid()) and observacao = 'Desmarcada pelo aluno';
end;
$$;
comment on function beach.remarcar_aula(uuid) is 'Aluno desfaz a desmarcação (até 2h antes), se a vaga ainda estiver livre.';

revoke execute on function beach.inicio_aula(uuid), beach.vagas_livres_aula(uuid), beach.validar_desmarcacao(uuid),
  beach.desmarcar_aula(uuid), beach.remarcar_aula(uuid) from public, anon;
grant execute on function beach.inicio_aula(uuid), beach.vagas_livres_aula(uuid), beach.validar_desmarcacao(uuid),
  beach.desmarcar_aula(uuid), beach.remarcar_aula(uuid) to authenticated, service_role;
