-- =============================================================================
-- Beach club: turmas, aulas, matrículas e presenças
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers de autorização (usados por triggers, funções e políticas RLS).
-- SECURITY DEFINER para ler beach.perfis sem cair em recursão de RLS.
-- -----------------------------------------------------------------------------
create or replace function beach.papel_atual()
returns beach.papel
language sql
stable
security definer
set search_path = ''
as $$
  select p.papel
  from beach.perfis p
  where p.id = (select auth.uid()) and p.ativo
$$;
comment on function beach.papel_atual() is 'Papel do usuário logado (null se não tiver perfil ativo).';

create or replace function beach.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(beach.papel_atual() in ('admin', 'recepcao'), false)
$$;
comment on function beach.is_staff() is 'true para admin e recepção.';

create or replace function beach.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(beach.papel_atual() = 'admin', false)
$$;

create or replace function beach.tem_papel(p_usuario uuid, p_papeis beach.papel[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from beach.perfis p
    where p.id = p_usuario and p.papel = any (p_papeis)
  )
$$;

-- Staff logado, chamadas com a service_role (backend/cron) ou o SQL Editor.
-- Obs.: dentro de SECURITY DEFINER o current_user é o dono da função, por isso
-- olhamos o papel do JWT e o session_user.
create or replace function beach.pode_administrar()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select beach.is_staff()
      or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
      or session_user = 'postgres'
$$;

-- Faixa de horário do dia, para impedir sobreposição de turmas.
create type beach.faixa_horario as range (subtype = time);

-- -----------------------------------------------------------------------------
-- Turmas: cada turma é UM horário semanal fixo.
-- Um aluno do plano 3x/semana se matricula em 3 turmas.
-- -----------------------------------------------------------------------------
create table beach.turmas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  modalidade_id uuid not null references beach.modalidades (id),
  nivel_id      uuid not null references beach.niveis (id),
  professor_id  uuid not null references beach.perfis (id),
  quadra_id     uuid not null references beach.quadras (id),
  dia_semana    smallint not null check (dia_semana between 1 and 7),  -- ISO: 1 = segunda ... 7 = domingo
  hora_inicio   time not null,
  hora_fim      time not null,
  vagas         smallint not null check (vagas > 0),
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (hora_fim > hora_inicio),
  -- A mesma quadra não pode ter duas turmas ativas no mesmo horário.
  constraint turmas_quadra_sem_conflito exclude using gist (
    quadra_id with =,
    dia_semana with =,
    beach.faixa_horario(hora_inicio, hora_fim) with &&
  ) where (ativo),
  -- O mesmo professor não pode dar duas turmas ao mesmo tempo.
  constraint turmas_professor_sem_conflito exclude using gist (
    professor_id with =,
    dia_semana with =,
    beach.faixa_horario(hora_inicio, hora_fim) with &&
  ) where (ativo)
);
create index turmas_professor_idx on beach.turmas (professor_id);
create index turmas_modalidade_idx on beach.turmas (modalidade_id);
create index turmas_nivel_idx on beach.turmas (nivel_id);
create index turmas_quadra_idx on beach.turmas (quadra_id);
create trigger turmas_updated_at before update on beach.turmas
  for each row execute function beach.tg_set_updated_at();

create or replace function beach.tg_turmas_valida_professor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not beach.tem_papel(new.professor_id, array['professor', 'admin']::beach.papel[]) then
    raise exception 'O perfil % não é professor', new.professor_id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger turmas_valida_professor before insert or update of professor_id on beach.turmas
  for each row execute function beach.tg_turmas_valida_professor();

-- -----------------------------------------------------------------------------
-- Aulas: cada ocorrência (data) de uma turma. É onde a presença é registrada.
-- professor_id/quadra_id podem diferir da turma (substituição, troca de quadra).
-- -----------------------------------------------------------------------------
create table beach.aulas (
  id           uuid primary key default gen_random_uuid(),
  turma_id     uuid not null references beach.turmas (id) on delete cascade,
  data         date not null,
  professor_id uuid references beach.perfis (id),
  quadra_id    uuid references beach.quadras (id),
  status       beach.status_aula not null default 'agendada',
  observacao   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (turma_id, data)
);
create index aulas_data_idx on beach.aulas (data);
create index aulas_professor_idx on beach.aulas (professor_id);
create trigger aulas_updated_at before update on beach.aulas
  for each row execute function beach.tg_set_updated_at();

-- Preenche professor/quadra a partir da turma quando não informados.
create or replace function beach.tg_aulas_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_turma beach.turmas%rowtype;
begin
  select * into v_turma from beach.turmas where id = new.turma_id;
  new.professor_id := coalesce(new.professor_id, v_turma.professor_id);
  new.quadra_id    := coalesce(new.quadra_id, v_turma.quadra_id);
  return new;
end;
$$;
create trigger aulas_defaults before insert on beach.aulas
  for each row execute function beach.tg_aulas_defaults();

-- -----------------------------------------------------------------------------
-- Matrículas: aluno + plano. As turmas ficam em matricula_turmas.
-- -----------------------------------------------------------------------------
create table beach.matriculas (
  id             uuid primary key default gen_random_uuid(),
  aluno_id       uuid not null references beach.perfis (id),
  plano_id       uuid not null references beach.planos (id),
  status         beach.status_matricula not null default 'ativa',
  data_inicio    date not null default current_date,
  data_fim       date,
  dia_vencimento smallint not null default 10 check (dia_vencimento between 1 and 28),
  valor_mensal   numeric(10, 2) not null check (valor_mensal >= 0),  -- congelado na matrícula (permite desconto)
  observacao     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (data_fim is null or data_fim >= data_inicio)
);
create index matriculas_aluno_idx on beach.matriculas (aluno_id);
create index matriculas_plano_idx on beach.matriculas (plano_id);
create index matriculas_status_idx on beach.matriculas (status);
create trigger matriculas_updated_at before update on beach.matriculas
  for each row execute function beach.tg_set_updated_at();

create or replace function beach.tg_matriculas_valida()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not beach.tem_papel(new.aluno_id, array['aluno']::beach.papel[]) then
    raise exception 'O perfil % não é aluno', new.aluno_id using errcode = 'check_violation';
  end if;
  -- Valor padrão: o valor do plano.
  if new.valor_mensal is null then
    select valor_mensal into new.valor_mensal from beach.planos where id = new.plano_id;
  end if;
  return new;
end;
$$;
create trigger matriculas_valida before insert or update of aluno_id, plano_id, valor_mensal on beach.matriculas
  for each row execute function beach.tg_matriculas_valida();

-- -----------------------------------------------------------------------------
-- Turmas de cada matrícula
-- -----------------------------------------------------------------------------
create table beach.matricula_turmas (
  matricula_id uuid not null references beach.matriculas (id) on delete cascade,
  turma_id     uuid not null references beach.turmas (id),
  created_at   timestamptz not null default now(),
  primary key (matricula_id, turma_id)
);
create index matricula_turmas_turma_idx on beach.matricula_turmas (turma_id);

-- Garante: (1) turma com vaga, (2) não passar do limite semanal do plano.
create or replace function beach.tg_matricula_turmas_valida()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_vagas     smallint;
  v_ocupadas  int;
  v_limite    smallint;
  v_atuais    int;
  v_status    beach.status_matricula;
begin
  -- Trava a turma para evitar duas matrículas simultâneas na última vaga.
  select vagas into v_vagas from beach.turmas where id = new.turma_id for update;

  select m.status, p.aulas_por_semana into v_status, v_limite
  from beach.matriculas m join beach.planos p on p.id = m.plano_id
  where m.id = new.matricula_id;

  if v_status <> 'ativa' then
    raise exception 'Só é possível vincular turmas a matrículas ativas';
  end if;

  select count(*) into v_ocupadas
  from beach.matricula_turmas mt join beach.matriculas m on m.id = mt.matricula_id
  where mt.turma_id = new.turma_id and m.status = 'ativa';

  if v_ocupadas >= v_vagas then
    raise exception 'Turma sem vagas (% de %)', v_ocupadas, v_vagas using errcode = 'check_violation';
  end if;

  select count(*) into v_atuais from beach.matricula_turmas where matricula_id = new.matricula_id;
  if v_atuais >= v_limite then
    raise exception 'O plano permite % aula(s) por semana', v_limite using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
create trigger matricula_turmas_valida before insert on beach.matricula_turmas
  for each row execute function beach.tg_matricula_turmas_valida();

-- -----------------------------------------------------------------------------
-- Presenças: uma linha por aluno por aula.
-- -----------------------------------------------------------------------------
create table beach.presencas (
  id             uuid primary key default gen_random_uuid(),
  aula_id        uuid not null references beach.aulas (id) on delete cascade,
  aluno_id       uuid not null references beach.perfis (id),
  status         beach.status_presenca not null default 'presente',
  registrado_por uuid references beach.perfis (id) default auth.uid(),
  observacao     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (aula_id, aluno_id)
);
create index presencas_aluno_idx on beach.presencas (aluno_id);
create trigger presencas_updated_at before update on beach.presencas
  for each row execute function beach.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Gera as aulas das turmas ativas num intervalo de datas (idempotente).
-- -----------------------------------------------------------------------------
create or replace function beach.gerar_aulas(p_inicio date, p_fim date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qtd integer;
begin
  if not beach.pode_administrar() then
    raise exception 'Apenas administração/recepção pode gerar aulas' using errcode = 'insufficient_privilege';
  end if;
  if p_fim < p_inicio or p_fim - p_inicio > 366 then
    raise exception 'Intervalo inválido (máximo de 1 ano)';
  end if;

  insert into beach.aulas (turma_id, data, professor_id, quadra_id)
  select t.id, d::date, t.professor_id, t.quadra_id
  from beach.turmas t
  cross join generate_series(p_inicio, p_fim, interval '1 day') d
  where t.ativo and extract(isodow from d) = t.dia_semana
  on conflict (turma_id, data) do nothing;

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;
comment on function beach.gerar_aulas(date, date) is 'Cria as aulas (ocorrências) das turmas ativas entre duas datas. Retorna quantas foram criadas.';
