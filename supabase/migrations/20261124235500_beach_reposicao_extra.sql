-- =============================================================================
-- Beach club: reposição e aula extra reservadas pelo aluno
-- (depende de 20261124234500_beach_desmarcar_aula)
--
-- Regras:
--   - Cada desmarcação vira 1 crédito de reposição, válido por 30 dias após a aula
--     desmarcada, para uma aula da MESMA modalidade em outra turma com vaga livre.
--   - Aula extra: planos com aulas_extras_semana > 0 (o 2x vem com 1) dão direito a
--     N aulas extras por semana (seg a dom) em vagas livres de outras turmas da
--     modalidade do plano. Na reserva, a extra da semana é usada antes do crédito.
--   - Reservar = presença lançada na aula escolhida + linha em beach.reposicoes.
--     Cancelar (até 2h antes) devolve o crédito/extra.
--   - Remarcar a aula desmarcada fica bloqueado enquanto o crédito estiver em uso.
-- =============================================================================

-- Aulas extras por semana incluídas no plano (o 2x dá direito a 1).
alter table beach.planos add column aulas_extras_semana smallint not null default 0
  check (aulas_extras_semana between 0 and 7);
comment on column beach.planos.aulas_extras_semana is 'Aulas extras por semana (seg a dom) que o aluno pode reservar em vagas livres de outras turmas.';
update beach.planos set aulas_extras_semana = 1 where aulas_por_semana = 2;

-- Reservas feitas pelo aluno em outras turmas. tipo 'reposicao' consome um crédito
-- (aula desmarcada); tipo 'extra' consome a aula extra semanal do plano.
create table beach.reposicoes (
  id                 uuid primary key default gen_random_uuid(),
  aluno_id           uuid not null references beach.perfis (id) on delete cascade,
  tipo               text not null default 'reposicao' check (tipo in ('reposicao', 'extra')),
  aula_desmarcada_id uuid references beach.aulas (id) on delete cascade,
  aula_reposicao_id  uuid not null references beach.aulas (id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (aula_desmarcada_id, aluno_id),
  unique (aula_reposicao_id, aluno_id),
  check ((tipo = 'extra') = (aula_desmarcada_id is null)),
  check (aula_desmarcada_id is distinct from aula_reposicao_id)
);
create index reposicoes_aluno_idx on beach.reposicoes (aluno_id);
create index reposicoes_aula_reposicao_idx on beach.reposicoes (aula_reposicao_id);
alter table beach.reposicoes enable row level security;
-- Só leitura pelo app (escrita via RPC SECURITY DEFINER).
revoke insert, update, delete on beach.reposicoes from authenticated;
create policy reposicoes_select on beach.reposicoes for select to authenticated
  using ((select beach.is_staff()) or aluno_id = (select auth.uid()) or beach.professor_da_aula(aula_reposicao_id));
create policy reposicoes_delete_staff on beach.reposicoes for delete to authenticated
  using ((select beach.is_staff()));
grant delete on beach.reposicoes to authenticated;

-- O aluno passa a enxergar as aulas onde tem presença lançada (reposição/avulso).
create or replace function beach.tem_presenca_na_aula(p_aula uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from beach.presencas where aula_id = p_aula and aluno_id = (select auth.uid()))
$$;
create policy aulas_select_presenca on beach.aulas for select to authenticated
  using (beach.tem_presenca_na_aula(id));

-- Vagas livres numa aula: vagas da turma - matriculados ativos na data
-- + matriculados que desmarcaram - avulsos/reposições lançados. Uso interno (sem checagem).
create or replace function beach.calc_vagas_livres(p_aula uuid)
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

-- Versão pública: staff, professor da aula ou aluno da turma.
create or replace function beach.vagas_livres_aula(p_aula uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_turma uuid;
begin
  select turma_id into v_turma from beach.aulas where id = p_aula;
  if v_turma is null then
    return null;
  end if;
  if not (beach.is_staff() or beach.professor_da_aula(p_aula) or beach.aluno_da_turma(v_turma)) then
    raise exception 'Sem permissão para ver esta aula' using errcode = 'insufficient_privilege';
  end if;
  return beach.calc_vagas_livres(p_aula);
end;
$$;
comment on function beach.vagas_livres_aula(uuid) is 'Vagas livres numa aula específica (considera desmarcações e reposições).';

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
  if exists (select 1 from beach.reposicoes where aula_desmarcada_id = p_aula and aluno_id = (select auth.uid())) then
    raise exception 'Você já usou esta desmarcação numa reposição. Cancele a reposição antes de remarcar.' using errcode = 'check_violation';
  end if;
  -- A própria desmarcação conta como 1 vaga livre; se ela foi ocupada, não há vaga.
  if beach.calc_vagas_livres(p_aula) < 1 then
    raise exception 'A vaga já foi ocupada por outro aluno. Fale com a recepção.' using errcode = 'check_violation';
  end if;

  delete from beach.presencas
  where aula_id = p_aula and aluno_id = (select auth.uid()) and observacao = 'Desmarcada pelo aluno';
end;
$$;
comment on function beach.remarcar_aula(uuid) is 'Aluno desfaz a desmarcação (até 2h antes), se a vaga ainda estiver livre.';

-- Aulas extras ainda disponíveis para o aluno na semana (seg a dom) da data, na modalidade.
create or replace function beach.extras_disponiveis(p_aluno uuid, p_data date, p_modalidade uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0,
    coalesce((
      select max(p.aulas_extras_semana)
      from beach.matriculas m join beach.planos p on p.id = m.plano_id
      where m.aluno_id = p_aluno
        and m.status = 'ativa'
        and m.data_inicio <= p_data
        and (m.data_fim is null or m.data_fim >= p_data)
        and (p.modalidade_id is null or p.modalidade_id = p_modalidade)
    ), 0)
    - (
      select count(*)
      from beach.reposicoes r join beach.aulas a on a.id = r.aula_reposicao_id
      where r.aluno_id = p_aluno and r.tipo = 'extra'
        and date_trunc('week', a.data) = date_trunc('week', p_data)
    ))::integer
$$;
comment on function beach.extras_disponiveis(uuid, date, uuid) is 'Aulas extras do plano ainda livres na semana da data.';

-- Créditos de reposição do aluno logado: desmarcações ainda não usadas e válidas.
create or replace function beach.meus_creditos_reposicao()
returns table (aula_desmarcada_id uuid, data date, turma text, modalidade_id uuid, modalidade text, valido_ate date)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.data, t.nome, t.modalidade_id, mo.nome, a.data + 30
  from beach.presencas pr
  join beach.aulas a on a.id = pr.aula_id
  join beach.turmas t on t.id = a.turma_id
  join beach.modalidades mo on mo.id = t.modalidade_id
  where pr.aluno_id = (select auth.uid())
    and pr.observacao = 'Desmarcada pelo aluno'
    and a.data + 30 >= current_date
    and not exists (select 1 from beach.reposicoes r where r.aula_desmarcada_id = a.id and r.aluno_id = pr.aluno_id)
  order by a.data
$$;
comment on function beach.meus_creditos_reposicao() is 'Desmarcações do aluno logado que ainda podem virar reposição (30 dias).';

-- Aulas com vaga livre onde o aluno logado pode repor (mesma modalidade de um crédito, outra turma).
create or replace function beach.vagas_para_reposicao(p_de date, p_ate date)
returns table (
  aula_id uuid, data date, hora_inicio time, hora_fim time, turma text, modalidade text,
  nivel text, quadra text, professor text, vagas_livres integer, usa_extra boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with creditos as (select * from beach.meus_creditos_reposicao()),
  minhas_turmas as (
    select mt.turma_id
    from beach.matricula_turmas mt join beach.matriculas m on m.id = mt.matricula_id
    where m.aluno_id = (select auth.uid()) and m.status = 'ativa'
  )
  select a.id, a.data, t.hora_inicio, t.hora_fim, t.nome, mo.nome, n.nome,
         coalesce(qa.nome, qt.nome), coalesce(pa.nome, pt.nome), beach.calc_vagas_livres(a.id),
         beach.extras_disponiveis((select auth.uid()), a.data, t.modalidade_id) > 0
  from beach.aulas a
  join beach.turmas t on t.id = a.turma_id
  join beach.modalidades mo on mo.id = t.modalidade_id
  join beach.niveis n on n.id = t.nivel_id
  left join beach.quadras qa on qa.id = a.quadra_id
  left join beach.quadras qt on qt.id = t.quadra_id
  left join beach.perfis pa on pa.id = a.professor_id
  left join beach.perfis pt on pt.id = t.professor_id
  where (select auth.uid()) is not null
    and a.status = 'agendada'
    and a.data between greatest(p_de, current_date) and least(p_ate, current_date + 30)
    and (a.data + t.hora_inicio) at time zone 'America/Sao_Paulo' > now() + interval '2 hours'
    and (t.modalidade_id in (select c.modalidade_id from creditos c where c.valido_ate >= a.data)
         or beach.extras_disponiveis((select auth.uid()), a.data, t.modalidade_id) > 0)
    and t.id not in (select turma_id from minhas_turmas)
    and not exists (select 1 from beach.presencas pr where pr.aula_id = a.id and pr.aluno_id = (select auth.uid()))
    and beach.calc_vagas_livres(a.id) > 0
  order by a.data, t.hora_inicio
$$;
comment on function beach.vagas_para_reposicao(date, date) is 'Aulas com vaga onde o aluno logado pode usar a aula extra da semana ou um crédito de reposição.';

create or replace function beach.reservar_reposicao(p_aula uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_aula    beach.aulas%rowtype;
  v_turma   beach.turmas%rowtype;
  v_credito uuid;
  v_tipo    text := 'reposicao';
  v_id      uuid;
begin
  if (select auth.uid()) is null or not beach.tem_papel((select auth.uid()), array['aluno']::beach.papel[]) then
    raise exception 'Apenas alunos podem reservar aulas' using errcode = 'insufficient_privilege';
  end if;
  select * into v_aula from beach.aulas where id = p_aula;
  if not found then
    raise exception 'Aula não encontrada';
  end if;
  -- Trava a turma: duas reservas simultâneas não pegam a mesma vaga.
  select * into v_turma from beach.turmas where id = v_aula.turma_id for update;

  if v_aula.status <> 'agendada' then
    raise exception 'Esta aula não está mais agendada' using errcode = 'check_violation';
  end if;
  if now() > beach.inicio_aula(p_aula) - interval '2 hours' then
    raise exception 'Só é possível reservar até 2 horas antes da aula' using errcode = 'check_violation';
  end if;
  if beach.aluno_da_turma(v_turma.id) then
    raise exception 'Esta aula já é da sua turma' using errcode = 'check_violation';
  end if;
  if exists (select 1 from beach.presencas where aula_id = p_aula and aluno_id = (select auth.uid())) then
    raise exception 'Você já está nesta aula' using errcode = 'check_violation';
  end if;
  if beach.calc_vagas_livres(p_aula) < 1 then
    raise exception 'Esta aula não tem mais vaga' using errcode = 'check_violation';
  end if;

  -- Primeiro a aula extra da semana (expira no domingo); senão, o crédito mais antigo
  -- da mesma modalidade, válido na data da reposição.
  if beach.extras_disponiveis((select auth.uid()), v_aula.data, v_turma.modalidade_id) > 0 then
    v_tipo := 'extra';
  else
    select c.aula_desmarcada_id into v_credito
    from beach.meus_creditos_reposicao() c
    where c.modalidade_id = v_turma.modalidade_id and c.valido_ate >= v_aula.data
    order by c.data
    limit 1;
    if v_credito is null then
      raise exception 'Você não tem aula extra nem crédito de reposição para esta modalidade nesta semana.' using errcode = 'check_violation';
    end if;
  end if;

  insert into beach.presencas (aula_id, aluno_id, status, registrado_por, observacao)
  values (p_aula, (select auth.uid()), 'presente', (select auth.uid()),
          case v_tipo when 'extra' then 'Aula extra reservada pelo aluno' else 'Reposição reservada pelo aluno' end);
  insert into beach.reposicoes (aluno_id, tipo, aula_desmarcada_id, aula_reposicao_id)
  values ((select auth.uid()), v_tipo, v_credito, p_aula)
  returning id into v_id;
  return v_id;
end;
$$;
comment on function beach.reservar_reposicao(uuid) is 'Aluno usa um crédito (desmarcação) para reservar vaga livre em outra turma.';

create or replace function beach.cancelar_reposicao(p_aula uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from beach.reposicoes where aula_reposicao_id = p_aula and aluno_id = (select auth.uid())) then
    raise exception 'Reposição não encontrada';
  end if;
  if now() > beach.inicio_aula(p_aula) - interval '2 hours' then
    raise exception 'Só é possível cancelar até 2 horas antes da aula' using errcode = 'check_violation';
  end if;
  delete from beach.presencas
  where aula_id = p_aula and aluno_id = (select auth.uid())
    and observacao in ('Reposição reservada pelo aluno', 'Aula extra reservada pelo aluno');
  delete from beach.reposicoes where aula_reposicao_id = p_aula and aluno_id = (select auth.uid());
end;
$$;
comment on function beach.cancelar_reposicao(uuid) is 'Aluno cancela a reposição (até 2h antes) e recupera o crédito.';

revoke execute on function beach.calc_vagas_livres(uuid), beach.vagas_livres_aula(uuid),
  beach.remarcar_aula(uuid), beach.tem_presenca_na_aula(uuid),
  beach.meus_creditos_reposicao(), beach.vagas_para_reposicao(date, date), beach.reservar_reposicao(uuid),
  beach.cancelar_reposicao(uuid), beach.extras_disponiveis(uuid, date, uuid) from public, anon;
grant execute on function beach.vagas_livres_aula(uuid),
  beach.remarcar_aula(uuid), beach.tem_presenca_na_aula(uuid),
  beach.meus_creditos_reposicao(), beach.vagas_para_reposicao(date, date), beach.reservar_reposicao(uuid),
  beach.cancelar_reposicao(uuid) to authenticated, service_role;
-- Internas: sem checagem de permissão, não expostas ao app.
revoke execute on function beach.calc_vagas_livres(uuid), beach.extras_disponiveis(uuid, date, uuid) from authenticated;
grant execute on function beach.calc_vagas_livres(uuid), beach.extras_disponiveis(uuid, date, uuid) to service_role;
