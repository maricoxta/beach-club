-- =============================================================================
-- Beach club: a recepção libera as vagas de reposição/aula extra
-- (depende de 20261124235500_beach_reposicao_extra)
--
-- Regras:
--   - Vaga livre (desmarcação ou turma com sobra) NÃO aparece mais sozinha para o aluno.
--     A recepção escolhe, por aula, quantas vagas liberar (até o total livre) e a partir
--     de quando (agora, 1 dia antes, 1 semana antes...).
--   - Disponível para reservar = mínimo entre (liberadas - já reservadas na aula) e as
--     vagas realmente livres. Quem clicar primeiro em "Reservar" leva (trava na turma).
--   - Só reserva quem tem matrícula ativa numa turma da MESMA modalidade e nível.
--   - Avisos no app: quando a liberação começa a valer, os alunos daquela modalidade e
--     nível (fora da própria turma) passam a ver o aviso "vaga disponível na turma X com
--     o professor Y". Calculado na leitura: não precisa de agendador.
-- =============================================================================

create table beach.liberacoes_vagas (
  aula_id     uuid primary key references beach.aulas (id) on delete cascade,
  vagas       smallint not null check (vagas between 1 and 50),
  liberar_em  timestamptz not null default now(),
  criado_por  uuid references beach.perfis (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table beach.liberacoes_vagas is 'Vagas de reposição/aula extra liberadas pela recepção, por aula, e a partir de quando.';
create trigger liberacoes_vagas_updated_at before update on beach.liberacoes_vagas
  for each row execute function beach.tg_set_updated_at();
create index liberacoes_vagas_liberar_em_idx on beach.liberacoes_vagas (liberar_em);
alter table beach.liberacoes_vagas enable row level security;
revoke insert, update, delete on beach.liberacoes_vagas from authenticated;
create policy liberacoes_vagas_select on beach.liberacoes_vagas for select to authenticated
  using ((select beach.is_staff()) or beach.professor_da_aula(aula_id));

-- Avisos que o aluno já viu (o aviso em si é calculado a partir da liberação).
create table beach.avisos_lidos (
  aluno_id uuid not null references beach.perfis (id) on delete cascade,
  aula_id  uuid not null references beach.aulas (id) on delete cascade,
  lido_em  timestamptz not null default now(),
  primary key (aluno_id, aula_id)
);
alter table beach.avisos_lidos enable row level security;
revoke insert, update, delete on beach.avisos_lidos from authenticated;
create policy avisos_lidos_select on beach.avisos_lidos for select to authenticated
  using (aluno_id = (select auth.uid()));

-- Aluno tem matrícula ativa (na data) numa turma desta modalidade e nível? Uso interno.
create or replace function beach.aluno_no_nivel(p_aluno uuid, p_modalidade uuid, p_nivel uuid, p_data date)
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
    where m.aluno_id = p_aluno and m.status = 'ativa'
      and m.data_inicio <= p_data and (m.data_fim is null or m.data_fim >= p_data)
      and t.modalidade_id = p_modalidade and t.nivel_id = p_nivel
  )
$$;

-- Vagas liberadas que ainda dá para reservar agora. Uso interno.
create or replace function beach.calc_vagas_liberadas(p_aula uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select greatest(0, least(
      l.vagas - (select count(*) from beach.reposicoes r where r.aula_reposicao_id = l.aula_id),
      beach.calc_vagas_livres(l.aula_id)
    ))::integer
    from beach.liberacoes_vagas l
    where l.aula_id = p_aula and l.liberar_em <= now()
  ), 0)
$$;

-- ---------------------------------------------------------------------------
-- Recepção
-- ---------------------------------------------------------------------------

-- Libera (ou ajusta) as vagas de uma aula. p_vagas = 0 tira a liberação.
create or replace function beach.liberar_vagas(p_aula uuid, p_vagas integer, p_liberar_em timestamptz default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_aula beach.aulas%rowtype;
  v_max  integer;
begin
  if not beach.is_staff() then
    raise exception 'Apenas a recepção pode liberar vagas' using errcode = 'insufficient_privilege';
  end if;
  select * into v_aula from beach.aulas where id = p_aula;
  if not found then
    raise exception 'Aula não encontrada';
  end if;
  -- Mesma trava da reserva: ajustar enquanto um aluno reserva não passa do limite.
  perform 1 from beach.turmas where id = v_aula.turma_id for update;

  if coalesce(p_vagas, 0) <= 0 then
    delete from beach.liberacoes_vagas where aula_id = p_aula;
    return;
  end if;
  if v_aula.status <> 'agendada' then
    raise exception 'Só dá para liberar vagas de aula agendada' using errcode = 'check_violation';
  end if;
  if now() > beach.inicio_aula(p_aula) - interval '2 hours' then
    raise exception 'Esta aula começa em menos de 2 horas' using errcode = 'check_violation';
  end if;
  -- Livres agora + as que já foram reservadas por reposição (continuam contando).
  v_max := beach.calc_vagas_livres(p_aula)
         + (select count(*) from beach.reposicoes where aula_reposicao_id = p_aula);
  if p_vagas > v_max then
    raise exception 'Esta aula só tem % vaga(s) livre(s)', v_max using errcode = 'check_violation';
  end if;
  if p_liberar_em is not null and p_liberar_em > beach.inicio_aula(p_aula) - interval '2 hours' then
    raise exception 'A liberação precisa ser antes do prazo de 2 horas da aula' using errcode = 'check_violation';
  end if;

  insert into beach.liberacoes_vagas (aula_id, vagas, liberar_em, criado_por)
  values (p_aula, p_vagas, coalesce(p_liberar_em, now()), (select auth.uid()))
  on conflict (aula_id) do update
    set vagas = excluded.vagas, liberar_em = excluded.liberar_em, criado_por = excluded.criado_por;
end;
$$;
comment on function beach.liberar_vagas(uuid, integer, timestamptz) is 'Recepção libera N vagas de reposição/aula extra numa aula, a partir de uma data/hora (0 = tira).';

-- Painel da recepção: aulas com vaga livre ou com liberação no período.
create or replace function beach.painel_vagas(p_de date, p_ate date)
returns table (
  aula_id uuid, data date, hora_inicio time, hora_fim time, turma text, modalidade text,
  nivel text, quadra text, professor text, vagas_turma smallint, vagas_livres integer,
  liberadas smallint, liberar_em timestamptz, reservadas integer, disponiveis_agora integer,
  alunos_avisados integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not beach.is_staff() then
    raise exception 'Apenas a recepção' using errcode = 'insufficient_privilege';
  end if;
  return query
  select a.id, a.data, t.hora_inicio, t.hora_fim, t.nome, mo.nome, n.nome,
         coalesce(qa.nome, qt.nome), coalesce(pa.nome, pt.nome), t.vagas,
         beach.calc_vagas_livres(a.id), l.vagas, l.liberar_em,
         (select count(*) from beach.reposicoes r where r.aula_reposicao_id = a.id)::integer,
         beach.calc_vagas_liberadas(a.id),
         (select count(distinct m.aluno_id)
          from beach.matricula_turmas mt
          join beach.matriculas m on m.id = mt.matricula_id
          join beach.turmas t2 on t2.id = mt.turma_id
          where m.status = 'ativa' and m.data_inicio <= a.data and (m.data_fim is null or m.data_fim >= a.data)
            and t2.modalidade_id = t.modalidade_id and t2.nivel_id = t.nivel_id
            and m.aluno_id not in (
              select m3.aluno_id from beach.matricula_turmas mt3 join beach.matriculas m3 on m3.id = mt3.matricula_id
              where mt3.turma_id = t.id and m3.status = 'ativa'))::integer
  from beach.aulas a
  join beach.turmas t on t.id = a.turma_id
  join beach.modalidades mo on mo.id = t.modalidade_id
  join beach.niveis n on n.id = t.nivel_id
  left join beach.quadras qa on qa.id = a.quadra_id
  left join beach.quadras qt on qt.id = t.quadra_id
  left join beach.perfis pa on pa.id = a.professor_id
  left join beach.perfis pt on pt.id = t.professor_id
  left join beach.liberacoes_vagas l on l.aula_id = a.id
  where a.status = 'agendada'
    and a.data between greatest(p_de, current_date) and p_ate
    and (a.data + t.hora_inicio) at time zone 'America/Sao_Paulo' > now()
    and (l.aula_id is not null or beach.calc_vagas_livres(a.id) > 0)
  order by a.data, t.hora_inicio;
end;
$$;
comment on function beach.painel_vagas(date, date) is 'Recepção: aulas com vaga livre ou liberada, quantas reservadas e quantos alunos recebem o aviso.';

-- ---------------------------------------------------------------------------
-- Aluno: só vê e reserva vagas liberadas, da sua modalidade e nível
-- ---------------------------------------------------------------------------

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
         coalesce(qa.nome, qt.nome), coalesce(pa.nome, pt.nome), beach.calc_vagas_liberadas(a.id),
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
    and beach.aluno_no_nivel((select auth.uid()), t.modalidade_id, t.nivel_id, a.data)
    and not exists (select 1 from beach.presencas pr where pr.aula_id = a.id and pr.aluno_id = (select auth.uid()))
    and beach.calc_vagas_liberadas(a.id) > 0
  order by a.data, t.hora_inicio
$$;
comment on function beach.vagas_para_reposicao(date, date) is 'Vagas liberadas pela recepção, da modalidade e nível do aluno logado, onde ele pode usar a extra da semana ou um crédito.';

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
  -- Trava a turma: dois alunos clicando juntos não pegam a mesma vaga (o 2º espera e
  -- já enxerga a reserva do 1º).
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
  if not beach.aluno_no_nivel((select auth.uid()), v_turma.modalidade_id, v_turma.nivel_id, v_aula.data) then
    raise exception 'Esta vaga é para alunos de outra modalidade ou nível' using errcode = 'check_violation';
  end if;
  if exists (select 1 from beach.presencas where aula_id = p_aula and aluno_id = (select auth.uid())) then
    raise exception 'Você já está nesta aula' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from beach.liberacoes_vagas where aula_id = p_aula and liberar_em <= now()) then
    raise exception 'Esta vaga ainda não foi liberada pela recepção' using errcode = 'check_violation';
  end if;
  if beach.calc_vagas_liberadas(p_aula) < 1 then
    raise exception 'Que pena, outro aluno pegou a vaga antes. Fique de olho nos próximos avisos.' using errcode = 'check_violation';
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
comment on function beach.reservar_reposicao(uuid) is 'Aluno reserva uma vaga liberada pela recepção (extra da semana ou crédito de reposição). Primeiro a clicar leva.';

-- Avisos do aluno logado: vagas liberadas na sua modalidade e nível, em outras turmas.
create or replace function beach.meus_avisos()
returns table (
  aula_id uuid, liberado_em timestamptz, data date, hora_inicio time, hora_fim time, turma text,
  modalidade text, nivel text, quadra text, professor text, vagas_disponiveis integer,
  lido boolean, situacao text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, l.liberar_em, a.data, t.hora_inicio, t.hora_fim, t.nome, mo.nome, n.nome,
         coalesce(qa.nome, qt.nome), coalesce(pa.nome, pt.nome), beach.calc_vagas_liberadas(a.id),
         exists (select 1 from beach.avisos_lidos al where al.aula_id = a.id and al.aluno_id = (select auth.uid())),
         case
           when exists (select 1 from beach.presencas pr where pr.aula_id = a.id and pr.aluno_id = (select auth.uid())) then 'reservada'
           when beach.calc_vagas_liberadas(a.id) < 1 then 'esgotada'
           when beach.extras_disponiveis((select auth.uid()), a.data, t.modalidade_id) > 0
             or exists (select 1 from beach.meus_creditos_reposicao() c
                        where c.modalidade_id = t.modalidade_id and c.valido_ate >= a.data) then 'disponivel'
           else 'sem_credito'
         end
  from beach.liberacoes_vagas l
  join beach.aulas a on a.id = l.aula_id
  join beach.turmas t on t.id = a.turma_id
  join beach.modalidades mo on mo.id = t.modalidade_id
  join beach.niveis n on n.id = t.nivel_id
  left join beach.quadras qa on qa.id = a.quadra_id
  left join beach.quadras qt on qt.id = t.quadra_id
  left join beach.perfis pa on pa.id = a.professor_id
  left join beach.perfis pt on pt.id = t.professor_id
  where (select auth.uid()) is not null
    and l.liberar_em <= now()
    and a.status = 'agendada'
    and (a.data + t.hora_inicio) at time zone 'America/Sao_Paulo' > now() + interval '2 hours'
    and not beach.aluno_da_turma(t.id)
    and beach.aluno_no_nivel((select auth.uid()), t.modalidade_id, t.nivel_id, a.data)
  order by l.liberar_em desc, a.data, t.hora_inicio
$$;
comment on function beach.meus_avisos() is 'Avisos de vaga liberada para o aluno logado (modalidade e nível dele), com situação: disponivel, esgotada, reservada, sem_credito.';

create or replace function beach.contar_avisos_nao_lidos()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from beach.meus_avisos() where not lido and situacao = 'disponivel'
$$;

create or replace function beach.marcar_avisos_lidos()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into beach.avisos_lidos (aluno_id, aula_id)
  select (select auth.uid()), aula_id from beach.meus_avisos() where not lido
  on conflict do nothing
$$;

revoke execute on function beach.aluno_no_nivel(uuid, uuid, uuid, date), beach.calc_vagas_liberadas(uuid),
  beach.liberar_vagas(uuid, integer, timestamptz), beach.painel_vagas(date, date),
  beach.meus_avisos(), beach.contar_avisos_nao_lidos(), beach.marcar_avisos_lidos() from public, anon;
grant execute on function beach.liberar_vagas(uuid, integer, timestamptz), beach.painel_vagas(date, date),
  beach.meus_avisos(), beach.contar_avisos_nao_lidos(), beach.marcar_avisos_lidos() to authenticated, service_role;
-- Internas: sem checagem de permissão.
revoke execute on function beach.aluno_no_nivel(uuid, uuid, uuid, date), beach.calc_vagas_liberadas(uuid) from authenticated;
grant execute on function beach.aluno_no_nivel(uuid, uuid, uuid, date), beach.calc_vagas_liberadas(uuid) to service_role;
