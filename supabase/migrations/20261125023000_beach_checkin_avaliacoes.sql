-- =============================================================================
-- Beach club: check-in do aluno, avaliação de nível pelo professor e avaliação anônima da aula
-- (depende de 20261125021000_beach_aviso_desmarcacao)
--
--   - Check-in: o aluno da turma confirma que vai à aula até 2 horas antes do início.
--     Reposição/aula extra reservada já conta como confirmada. Desmarcação prevalece.
--   - Avaliação mensal do aluno: o professor dá de 1 a 5 estrelas + comentário fundamentado
--     sobre o desempenho no nível atual (uma por aluno/modalidade/mês). Só sobe de nível
--     (entrar em turma de nível acima) quem tem a última avaliação com 5 estrelas.
--   - Avaliação da aula: nota 1 a 5 + comentário, anônima. A nota fica em avaliacoes_aula
--     sem aluno nem horário; avaliacoes_aula_feitas só registra que o aluno já avaliou
--     (para não repetir). As duas tabelas não têm como ser cruzadas.
-- Tabelas com id próprio (sem PK composta de duas FKs) para não criar relação ambígua no PostgREST.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Check-in
-- ---------------------------------------------------------------------------
create table beach.checkins (
  id         uuid primary key default gen_random_uuid(),
  aula_id    uuid not null references beach.aulas (id) on delete cascade,
  aluno_id   uuid not null references beach.perfis (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (aula_id, aluno_id)
);
create index checkins_aluno_idx on beach.checkins (aluno_id);
alter table beach.checkins enable row level security;
revoke insert, update, delete on beach.checkins from authenticated;
create policy checkins_select on beach.checkins for select to authenticated
  using ((select beach.is_staff()) or aluno_id = (select auth.uid()) or beach.professor_da_aula(aula_id));

-- Aluno com matrícula ativa na turma da aula, na data da aula. Uso interno.
create or replace function beach.matriculado_na_aula(p_aluno uuid, p_aula uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from beach.aulas a
    join beach.matricula_turmas mt on mt.turma_id = a.turma_id
    join beach.matriculas m on m.id = mt.matricula_id
    where a.id = p_aula and m.aluno_id = p_aluno and m.status = 'ativa'
      and m.data_inicio <= a.data and (m.data_fim is null or m.data_fim >= a.data)
  )
$$;

create or replace function beach.fazer_checkin(p_aula uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status beach.status_aula;
  v_obs    text;
begin
  select status into v_status from beach.aulas where id = p_aula;
  if v_status is null then
    raise exception 'Aula não encontrada';
  end if;
  if v_status <> 'agendada' then
    raise exception 'Esta aula não está agendada' using errcode = 'check_violation';
  end if;
  if now() > beach.inicio_aula(p_aula) - interval '2 hours' then
    raise exception 'O check-in fecha 2 horas antes da aula' using errcode = 'check_violation';
  end if;
  select observacao into v_obs from beach.presencas where aula_id = p_aula and aluno_id = (select auth.uid());
  if v_obs = 'Desmarcada pelo aluno' then
    raise exception 'Você desmarcou esta aula. Remarque antes de fazer o check-in.' using errcode = 'check_violation';
  end if;
  if v_obs is not null then
    return;  -- reposição/extra/avulso: já confirmado
  end if;
  if not beach.matriculado_na_aula((select auth.uid()), p_aula) then
    raise exception 'Esta aula não é da sua turma' using errcode = 'insufficient_privilege';
  end if;
  insert into beach.checkins (aula_id, aluno_id) values (p_aula, (select auth.uid()))
  on conflict (aula_id, aluno_id) do nothing;
end;
$$;
comment on function beach.fazer_checkin(uuid) is 'Aluno confirma presença na aula da turma dele, até 2h antes.';

create or replace function beach.desfazer_checkin(p_aula uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if now() > beach.inicio_aula(p_aula) - interval '2 hours' then
    raise exception 'O check-in fecha 2 horas antes da aula' using errcode = 'check_violation';
  end if;
  delete from beach.checkins where aula_id = p_aula and aluno_id = (select auth.uid());
end;
$$;

-- Lista de check-in de uma aula: professor da aula ou recepção.
create or replace function beach.lista_checkin(p_aula uuid)
returns table (aluno_id uuid, nome text, tipo text, situacao text, checkin_em timestamptz, ultima_nota smallint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_aula beach.aulas%rowtype;
  v_modalidade uuid;
begin
  select * into v_aula from beach.aulas where id = p_aula;
  if not found then
    raise exception 'Aula não encontrada';
  end if;
  select modalidade_id into v_modalidade from beach.turmas where id = v_aula.turma_id;
  if not (beach.is_staff() or beach.professor_da_aula(p_aula)) then
    raise exception 'Sem permissão para ver esta aula' using errcode = 'insufficient_privilege';
  end if;
  return query
  with matriculados as (
    select distinct m.aluno_id
    from beach.matricula_turmas mt join beach.matriculas m on m.id = mt.matricula_id
    where mt.turma_id = v_aula.turma_id and m.status = 'ativa'
      and m.data_inicio <= v_aula.data and (m.data_fim is null or m.data_fim >= v_aula.data)
  ),
  alunos as (
    select aluno_id from matriculados
    union
    select aluno_id from beach.presencas where aula_id = p_aula
  )
  select al.aluno_id, p.nome,
         case
           when al.aluno_id in (select aluno_id from matriculados) then 'turma'
           when pr.observacao = 'Aula extra reservada pelo aluno' then 'extra'
           when pr.observacao = 'Reposição reservada pelo aluno' then 'reposicao'
           else 'avulso'
         end,
         case
           when pr.observacao = 'Desmarcada pelo aluno' then 'desmarcou'
           when ck.id is not null or (pr.id is not null and al.aluno_id not in (select aluno_id from matriculados)) then 'confirmado'
           else 'sem_checkin'
         end,
         coalesce(ck.created_at, case when al.aluno_id not in (select aluno_id from matriculados) then pr.created_at end),
         (select av.nota from beach.avaliacoes_aluno av
          where av.aluno_id = al.aluno_id and av.modalidade_id = v_modalidade
          order by av.mes desc, av.updated_at desc limit 1)
  from alunos al
  join beach.perfis p on p.id = al.aluno_id
  left join beach.presencas pr on pr.aula_id = p_aula and pr.aluno_id = al.aluno_id
  left join beach.checkins ck on ck.aula_id = p_aula and ck.aluno_id = al.aluno_id
  order by 4, p.nome;
end;
$$;

-- ---------------------------------------------------------------------------
-- Avaliação mensal do aluno (professor -> aluno)
--   Uma por aluno, por modalidade, por mês. Nota de 1 a 5 estrelas sobre o desempenho
--   no nível atual (o nível da turma, guardado na avaliação) + comentário fundamentado.
--   O aluno só sobe de nível se a última avaliação na modalidade tiver 5 estrelas.
-- ---------------------------------------------------------------------------
create table beach.avaliacoes_aluno (
  id            uuid primary key default gen_random_uuid(),
  aluno_id      uuid not null references beach.perfis (id) on delete cascade,
  professor_id  uuid references beach.perfis (id) on delete set null,
  turma_id      uuid references beach.turmas (id) on delete set null,
  modalidade_id uuid not null references beach.modalidades (id),
  nivel_id      uuid not null references beach.niveis (id),
  mes           date not null check (mes = date_trunc('month', mes)::date),
  nota          smallint not null check (nota between 1 and 5),
  comentario    text not null check (char_length(trim(comentario)) between 20 and 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (aluno_id, modalidade_id, mes)
);
create index avaliacoes_aluno_professor_idx on beach.avaliacoes_aluno (professor_id, mes);
create index avaliacoes_aluno_mes_idx on beach.avaliacoes_aluno (mes desc);
alter table beach.avaliacoes_aluno enable row level security;
revoke insert, update, delete on beach.avaliacoes_aluno from authenticated;
-- Leem: recepção/admin, o professor autor e o próprio aluno.
create policy avaliacoes_aluno_select on beach.avaliacoes_aluno for select to authenticated
  using ((select beach.is_staff()) or professor_id = (select auth.uid()) or aluno_id = (select auth.uid()));

-- Última avaliação do aluno na modalidade (interna).
create or replace function beach.ultima_avaliacao_aluno(p_aluno uuid, p_modalidade uuid)
returns beach.avaliacoes_aluno
language sql
stable
security definer
set search_path = ''
as $$
  select * from beach.avaliacoes_aluno
  where aluno_id = p_aluno and modalidade_id = p_modalidade
  order by mes desc, updated_at desc
  limit 1
$$;

-- Professor avalia o aluno de uma turma dele (recepção/admin também podem).
-- No mesmo mês o autor pode corrigir a avaliação; outro professor não sobrescreve.
create or replace function beach.avaliar_aluno(p_aluno uuid, p_turma uuid, p_nota integer, p_comentario text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_turma beach.turmas%rowtype;
  v_mes   date := date_trunc('month', beach.hoje())::date;
  v_atual beach.avaliacoes_aluno%rowtype;
  v_id    uuid;
begin
  select * into v_turma from beach.turmas where id = p_turma;
  if not found then
    raise exception 'Turma não encontrada';
  end if;
  if not (beach.is_staff() or v_turma.professor_id = (select auth.uid())) then
    raise exception 'Você só pode avaliar alunos das suas turmas' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from beach.matricula_turmas mt join beach.matriculas m on m.id = mt.matricula_id
    where mt.turma_id = p_turma and m.aluno_id = p_aluno and m.status = 'ativa') then
    raise exception 'Este aluno não está matriculado nesta turma' using errcode = 'check_violation';
  end if;
  if p_nota is null or p_nota not between 1 and 5 then
    raise exception 'A nota vai de 1 a 5 estrelas' using errcode = 'check_violation';
  end if;
  if char_length(trim(coalesce(p_comentario, ''))) < 20 then
    raise exception 'Escreva um comentário fundamentado (pelo menos 20 caracteres)' using errcode = 'check_violation';
  end if;

  select * into v_atual from beach.avaliacoes_aluno
  where aluno_id = p_aluno and modalidade_id = v_turma.modalidade_id and mes = v_mes
  for update;
  if found then
    if v_atual.professor_id is distinct from (select auth.uid()) and not beach.is_staff() then
      raise exception 'Este aluno já foi avaliado este mês por outro professor' using errcode = 'check_violation';
    end if;
    update beach.avaliacoes_aluno
    set nota = p_nota, comentario = trim(p_comentario), turma_id = p_turma, nivel_id = v_turma.nivel_id,
        professor_id = (select auth.uid()), updated_at = now()
    where id = v_atual.id;
    return v_atual.id;
  end if;

  insert into beach.avaliacoes_aluno (aluno_id, professor_id, turma_id, modalidade_id, nivel_id, mes, nota, comentario)
  values (p_aluno, (select auth.uid()), p_turma, v_turma.modalidade_id, v_turma.nivel_id, v_mes, p_nota, trim(p_comentario))
  returning id into v_id;
  return v_id;
end;
$$;
comment on function beach.avaliar_aluno(uuid, uuid, integer, text) is 'Avaliação mensal do aluno (1 a 5 estrelas + comentário) no nível da turma. 5 estrelas libera subir de nível.';

-- Alunos das turmas do professor logado (recepção/admin: todas), com a avaliação do mês.
create or replace function beach.alunos_para_avaliar()
returns table (
  turma_id uuid, turma text, modalidade text, nivel text, aluno_id uuid, aluno text,
  nota_mes smallint, comentario_mes text, avaliado_por text, pode_editar boolean,
  ultima_nota smallint, ultimo_mes date
)
language sql
stable
security definer
set search_path = ''
as $$
  with mes as (select date_trunc('month', beach.hoje())::date as m)
  select t.id, t.nome, mo.nome, n.nome, p.id, p.nome,
         am.nota, am.comentario, pa.nome,
         am.id is null or am.professor_id = (select auth.uid()) or beach.is_staff(),
         ul.nota, ul.mes
  from beach.turmas t
  join beach.modalidades mo on mo.id = t.modalidade_id
  join beach.niveis n on n.id = t.nivel_id
  join beach.matricula_turmas mt on mt.turma_id = t.id
  join beach.matriculas m on m.id = mt.matricula_id and m.status = 'ativa'
  join beach.perfis p on p.id = m.aluno_id
  cross join mes
  left join beach.avaliacoes_aluno am
    on am.aluno_id = p.id and am.modalidade_id = t.modalidade_id and am.mes = mes.m
  left join beach.perfis pa on pa.id = am.professor_id
  left join lateral (
    select a.nota, a.mes from beach.avaliacoes_aluno a
    where a.aluno_id = p.id and a.modalidade_id = t.modalidade_id and a.mes < mes.m
    order by a.mes desc limit 1
  ) ul on true
  where t.ativo and (beach.is_staff() or t.professor_id = (select auth.uid()))
  order by t.nome, p.nome
$$;

-- Trava de nível: ao colocar o aluno numa turma de nível acima do que ele já teve na
-- modalidade, exige que a última avaliação dele nessa modalidade seja 5 estrelas.
-- Primeira turma do aluno na modalidade (sem histórico) entra em qualquer nível.
create or replace function beach.tg_matricula_turmas_nivel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno      uuid;
  v_modalidade uuid;
  v_ordem      smallint;
  v_base       smallint;
  v_ultima     beach.avaliacoes_aluno%rowtype;
begin
  select m.aluno_id into v_aluno from beach.matriculas m where m.id = new.matricula_id;
  select t.modalidade_id, n.ordem into v_modalidade, v_ordem
  from beach.turmas t join beach.niveis n on n.id = t.nivel_id where t.id = new.turma_id;

  -- Nível mais alto que o aluno já teve na modalidade: turmas (de qualquer matrícula) e avaliações.
  select max(o) into v_base from (
    select n.ordem as o
    from beach.matricula_turmas mt
    join beach.matriculas m on m.id = mt.matricula_id
    join beach.turmas t on t.id = mt.turma_id
    join beach.niveis n on n.id = t.nivel_id
    where m.aluno_id = v_aluno and t.modalidade_id = v_modalidade
      and not (mt.matricula_id = new.matricula_id and mt.turma_id = new.turma_id)
    union all
    select n.ordem from beach.avaliacoes_aluno a join beach.niveis n on n.id = a.nivel_id
    where a.aluno_id = v_aluno and a.modalidade_id = v_modalidade
  ) h;

  if v_base is null or v_ordem <= v_base then
    return new;
  end if;

  v_ultima := beach.ultima_avaliacao_aluno(v_aluno, v_modalidade);
  if v_ultima.id is null or v_ultima.nota < 5 then
    raise exception 'Para subir de nível o aluno precisa ter a última avaliação do professor com 5 estrelas%',
      case when v_ultima.id is null then ' (ele ainda não foi avaliado)'
           else ' (a última foi ' || v_ultima.nota || ')' end
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger matricula_turmas_nivel before insert on beach.matricula_turmas
  for each row execute function beach.tg_matricula_turmas_nivel();

-- ---------------------------------------------------------------------------
-- Avaliação anônima da aula (aluno -> aula/professor)
-- ---------------------------------------------------------------------------
create table beach.avaliacoes_aula (
  id           uuid primary key default gen_random_uuid(),
  aula_id      uuid not null references beach.aulas (id) on delete cascade,
  professor_id uuid references beach.perfis (id) on delete set null,
  nota         smallint not null check (nota between 1 and 5),
  comentario   text check (char_length(comentario) <= 1000)
  -- sem aluno e sem horário: anônima
);
create index avaliacoes_aula_aula_idx on beach.avaliacoes_aula (aula_id);
create index avaliacoes_aula_professor_idx on beach.avaliacoes_aula (professor_id);
alter table beach.avaliacoes_aula enable row level security;
revoke insert, update, delete on beach.avaliacoes_aula from authenticated;
create policy avaliacoes_aula_select on beach.avaliacoes_aula for select to authenticated
  using ((select beach.is_staff()) or professor_id = (select auth.uid()));

create table beach.avaliacoes_aula_feitas (
  id       uuid primary key default gen_random_uuid(),
  aula_id  uuid not null references beach.aulas (id) on delete cascade,
  aluno_id uuid not null references beach.perfis (id) on delete cascade,
  unique (aula_id, aluno_id)
);
alter table beach.avaliacoes_aula_feitas enable row level security;
revoke insert, update, delete on beach.avaliacoes_aula_feitas from authenticated;
create policy avaliacoes_aula_feitas_select on beach.avaliacoes_aula_feitas for select to authenticated
  using (aluno_id = (select auth.uid()));

-- Aluno participou da aula: matriculado e não desmarcou nem levou falta, ou reposição/avulso presente.
create or replace function beach.participou_da_aula(p_aluno uuid, p_aula uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from beach.presencas where aula_id = p_aula and aluno_id = p_aluno) then
      exists (select 1 from beach.presencas where aula_id = p_aula and aluno_id = p_aluno and status = 'presente')
    else beach.matriculado_na_aula(p_aluno, p_aula)
  end
$$;

-- Aulas dos últimos 7 dias que o aluno logado pode avaliar.
create or replace function beach.aulas_para_avaliar()
returns table (aula_id uuid, data date, hora_inicio time, hora_fim time, turma text, professor text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.data, t.hora_inicio, t.hora_fim, t.nome, coalesce(pa.nome, pt.nome)
  from beach.aulas a
  join beach.turmas t on t.id = a.turma_id
  left join beach.perfis pa on pa.id = a.professor_id
  left join beach.perfis pt on pt.id = t.professor_id
  where (select auth.uid()) is not null
    and a.status <> 'cancelada'
    and a.data between current_date - 7 and current_date
    and (a.data + t.hora_inicio) at time zone 'America/Sao_Paulo' < now()
    and beach.participou_da_aula((select auth.uid()), a.id)
    and not exists (select 1 from beach.avaliacoes_aula_feitas f where f.aula_id = a.id and f.aluno_id = (select auth.uid()))
  order by a.data desc, t.hora_inicio desc
$$;

create or replace function beach.avaliar_aula(p_aula uuid, p_nota integer, p_comentario text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_prof uuid;
begin
  if (select auth.uid()) is null or not beach.tem_papel((select auth.uid()), array['aluno']::beach.papel[]) then
    raise exception 'Apenas alunos avaliam aulas' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from beach.aulas_para_avaliar() where aula_id = p_aula) then
    raise exception 'Esta aula não está disponível para avaliação (já avaliada, fora do prazo de 7 dias ou você não participou)' using errcode = 'check_violation';
  end if;
  if p_nota is null or p_nota not between 1 and 5 then
    raise exception 'Dê uma nota de 1 a 5' using errcode = 'check_violation';
  end if;
  select coalesce(a.professor_id, t.professor_id) into v_prof
  from beach.aulas a join beach.turmas t on t.id = a.turma_id where a.id = p_aula;
  insert into beach.avaliacoes_aula_feitas (aula_id, aluno_id) values (p_aula, (select auth.uid()));
  insert into beach.avaliacoes_aula (aula_id, professor_id, nota, comentario)
  values (p_aula, v_prof, p_nota, nullif(trim(p_comentario), ''));
end;
$$;
comment on function beach.avaliar_aula(uuid, integer, text) is 'Aluno avalia a aula (1 a 5) de forma anônima, até 7 dias depois.';

-- Resumo por professor (recepção vê todos; professor vê o dele).
create or replace function beach.resumo_avaliacoes()
returns table (professor_id uuid, professor text, avaliacoes integer, media numeric, ultimos_30d integer, media_30d numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nome, count(*)::integer, round(avg(av.nota), 1),
         count(*) filter (where a.data >= current_date - 30)::integer,
         round(avg(av.nota) filter (where a.data >= current_date - 30), 1)
  from beach.avaliacoes_aula av
  join beach.aulas a on a.id = av.aula_id
  join beach.perfis p on p.id = av.professor_id
  where beach.is_staff() or av.professor_id = (select auth.uid())
  group by p.id, p.nome
  order by p.nome
$$;

revoke execute on function beach.matriculado_na_aula(uuid, uuid), beach.fazer_checkin(uuid), beach.desfazer_checkin(uuid),
  beach.lista_checkin(uuid), beach.avaliar_aluno(uuid, uuid, integer, text), beach.alunos_para_avaliar(), beach.participou_da_aula(uuid, uuid),
  beach.aulas_para_avaliar(), beach.avaliar_aula(uuid, integer, text), beach.resumo_avaliacoes() from public, anon;
grant execute on function beach.fazer_checkin(uuid), beach.desfazer_checkin(uuid), beach.lista_checkin(uuid),
  beach.avaliar_aluno(uuid, uuid, integer, text), beach.alunos_para_avaliar(), beach.aulas_para_avaliar(), beach.avaliar_aula(uuid, integer, text),
  beach.resumo_avaliacoes() to authenticated, service_role;
revoke execute on function beach.ultima_avaliacao_aluno(uuid, uuid), beach.tg_matricula_turmas_nivel() from public, anon, authenticated;
revoke execute on function beach.matriculado_na_aula(uuid, uuid), beach.participou_da_aula(uuid, uuid) from authenticated;
grant execute on function beach.matriculado_na_aula(uuid, uuid), beach.participou_da_aula(uuid, uuid),
  beach.ultima_avaliacao_aluno(uuid, uuid) to service_role;
