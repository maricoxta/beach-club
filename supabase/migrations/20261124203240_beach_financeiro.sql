-- =============================================================================
-- Beach club: financeiro (mensalidades, pagamentos), locações avulsas e relatórios
-- Datas "de negócio" usam o fuso America/Sao_Paulo (o servidor roda em UTC).
-- =============================================================================

create or replace function beach.hoje()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- -----------------------------------------------------------------------------
-- Mensalidades: uma por matrícula por competência (mês).
-- -----------------------------------------------------------------------------
create table beach.mensalidades (
  id           uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references beach.matriculas (id) on delete restrict,
  aluno_id     uuid not null references beach.perfis (id),  -- desnormalizado (preenchido por trigger) para RLS e relatórios
  competencia  date not null check (extract(day from competencia) = 1),  -- sempre o dia 1 do mês
  vencimento   date not null,
  valor        numeric(10, 2) not null check (valor >= 0),
  desconto     numeric(10, 2) not null default 0 check (desconto >= 0),
  status       beach.status_mensalidade not null default 'aberta',
  observacao   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (matricula_id, competencia),
  check (desconto <= valor)
);
create index mensalidades_aluno_idx on beach.mensalidades (aluno_id);
create index mensalidades_status_venc_idx on beach.mensalidades (status, vencimento);
create index mensalidades_competencia_idx on beach.mensalidades (competencia);
create trigger mensalidades_updated_at before update on beach.mensalidades
  for each row execute function beach.tg_set_updated_at();

create or replace function beach.tg_mensalidades_aluno()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select aluno_id into new.aluno_id from beach.matriculas where id = new.matricula_id;
  return new;
end;
$$;
create trigger mensalidades_aluno before insert or update of matricula_id on beach.mensalidades
  for each row execute function beach.tg_mensalidades_aluno();

-- -----------------------------------------------------------------------------
-- Locações avulsas de quadra (cobradas por hora)
-- -----------------------------------------------------------------------------
create table beach.locacoes (
  id               uuid primary key default gen_random_uuid(),
  quadra_id        uuid not null references beach.quadras (id),
  cliente_id       uuid references beach.perfis (id),  -- se for aluno/usuário cadastrado
  cliente_nome     text,                               -- se for cliente avulso
  cliente_telefone text,
  inicio           timestamptz not null,
  fim              timestamptz not null,
  valor_hora       numeric(10, 2) not null check (valor_hora >= 0),  -- congelado no momento da reserva
  horas            numeric(5, 2) generated always as (round((extract(epoch from (fim - inicio)) / 3600)::numeric, 2)) stored,
  valor_total      numeric(10, 2) generated always as (round(valor_hora * (extract(epoch from (fim - inicio)) / 3600)::numeric, 2)) stored,
  status           beach.status_locacao not null default 'reservada',
  observacao       text,
  criado_por       uuid references beach.perfis (id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (fim > inicio),
  -- Locação por hora cheia (1h, 2h, ...).
  check (extract(epoch from (fim - inicio))::int % 3600 = 0),
  check (cliente_id is not null or cliente_nome is not null),
  -- Duas locações ativas não podem ocupar a mesma quadra ao mesmo tempo.
  constraint locacoes_sem_conflito exclude using gist (
    quadra_id with =,
    tstzrange(inicio, fim) with &&
  ) where (status <> 'cancelada')
);
create index locacoes_inicio_idx on beach.locacoes (inicio);
create index locacoes_cliente_idx on beach.locacoes (cliente_id);
create trigger locacoes_updated_at before update on beach.locacoes
  for each row execute function beach.tg_set_updated_at();

-- Preço padrão vindo da quadra + bloqueio de conflito com turmas fixas.
create or replace function beach.tg_locacoes_valida()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ini_local timestamp := new.inicio at time zone 'America/Sao_Paulo';
  v_fim_local timestamp := new.fim at time zone 'America/Sao_Paulo';
begin
  if new.valor_hora is null then
    select valor_hora into new.valor_hora from beach.quadras where id = new.quadra_id;
  end if;

  if new.status = 'cancelada' then
    return new;
  end if;

  if v_ini_local::date <> (v_fim_local - interval '1 microsecond')::date then
    raise exception 'A locação deve começar e terminar no mesmo dia';
  end if;

  -- Conflito com turma ativa nessa quadra, a menos que a aula do dia esteja cancelada.
  if exists (
    select 1
    from beach.turmas t
    where t.ativo
      and t.quadra_id = new.quadra_id
      and t.dia_semana = extract(isodow from v_ini_local)
      and beach.faixa_horario(t.hora_inicio, t.hora_fim)
          && beach.faixa_horario(v_ini_local::time, (v_fim_local - interval '1 microsecond')::time, '[]')
      and not exists (
        select 1 from beach.aulas a
        where a.turma_id = t.id and a.data = v_ini_local::date and a.status = 'cancelada'
      )
  ) then
    raise exception 'Horário ocupado por uma turma nessa quadra' using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;
create trigger locacoes_valida before insert or update of quadra_id, inicio, fim, status, valor_hora on beach.locacoes
  for each row execute function beach.tg_locacoes_valida();

-- -----------------------------------------------------------------------------
-- Pagamentos: cada pagamento quita (total ou parcialmente) uma mensalidade OU uma locação.
-- -----------------------------------------------------------------------------
create table beach.pagamentos (
  id             uuid primary key default gen_random_uuid(),
  mensalidade_id uuid references beach.mensalidades (id) on delete restrict,
  locacao_id     uuid references beach.locacoes (id) on delete restrict,
  valor          numeric(10, 2) not null check (valor > 0),
  pago_em        timestamptz not null default now(),
  forma          beach.forma_pagamento not null,
  registrado_por uuid references beach.perfis (id) default auth.uid(),
  observacao     text,
  created_at     timestamptz not null default now(),
  check (num_nonnulls(mensalidade_id, locacao_id) = 1)
);
create index pagamentos_mensalidade_idx on beach.pagamentos (mensalidade_id);
create index pagamentos_locacao_idx on beach.pagamentos (locacao_id);
create index pagamentos_pago_em_idx on beach.pagamentos (pago_em);

-- Mantém mensalidades.status coerente com a soma dos pagamentos.
create or replace function beach.tg_pagamentos_atualiza_mensalidade()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  v_ids := array_remove(array[
    case when tg_op <> 'INSERT' then old.mensalidade_id end,
    case when tg_op <> 'DELETE' then new.mensalidade_id end
  ], null);

  update beach.mensalidades m
  set status = case
                 when coalesce((select sum(p.valor) from beach.pagamentos p where p.mensalidade_id = m.id), 0)
                      >= m.valor - m.desconto then 'paga'::beach.status_mensalidade
                 else 'aberta'::beach.status_mensalidade
               end
  where m.id = any (v_ids) and m.status <> 'cancelada';

  return null;
end;
$$;
create trigger pagamentos_atualiza_mensalidade
  after insert or update or delete on beach.pagamentos
  for each row execute function beach.tg_pagamentos_atualiza_mensalidade();

-- -----------------------------------------------------------------------------
-- Gera as mensalidades de uma competência para as matrículas ativas (idempotente).
-- -----------------------------------------------------------------------------
create or replace function beach.gerar_mensalidades(p_competencia date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comp date := date_trunc('month', p_competencia)::date;
  v_qtd  integer;
begin
  if not beach.pode_administrar() then
    raise exception 'Apenas administração/recepção pode gerar mensalidades' using errcode = 'insufficient_privilege';
  end if;

  insert into beach.mensalidades (matricula_id, aluno_id, competencia, vencimento, valor)
  select m.id, m.aluno_id, v_comp,
         make_date(extract(year from v_comp)::int, extract(month from v_comp)::int, m.dia_vencimento),
         m.valor_mensal
  from beach.matriculas m
  where m.status = 'ativa'
    and m.data_inicio <= (v_comp + interval '1 month - 1 day')::date
    and (m.data_fim is null or m.data_fim >= v_comp)
  on conflict (matricula_id, competencia) do nothing;

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;
comment on function beach.gerar_mensalidades(date) is 'Cria as mensalidades do mês informado para todas as matrículas ativas. Retorna quantas foram criadas.';

-- -----------------------------------------------------------------------------
-- Views de leitura. security_invoker = true: respeitam o RLS de quem consulta.
-- -----------------------------------------------------------------------------

-- Mensalidade com valor pago e saldo.
create view beach.vw_mensalidades
with (security_invoker = true) as
select
  m.*,
  p.nome                                             as aluno_nome,
  m.valor - m.desconto                               as valor_liquido,
  coalesce(pg.valor_pago, 0)                         as valor_pago,
  greatest(m.valor - m.desconto - coalesce(pg.valor_pago, 0), 0) as saldo,
  (m.status = 'aberta' and m.vencimento < beach.hoje()) as vencida
from beach.mensalidades m
join beach.perfis p on p.id = m.aluno_id
left join lateral (
  select sum(x.valor) as valor_pago from beach.pagamentos x where x.mensalidade_id = m.id
) pg on true;

-- Inadimplência: mensalidades em aberto e vencidas.
create view beach.vw_inadimplencia
with (security_invoker = true) as
select
  v.aluno_id,
  v.aluno_nome,
  count(*)                          as mensalidades_vencidas,
  sum(v.saldo)                      as valor_em_aberto,
  min(v.vencimento)                 as vencimento_mais_antigo,
  beach.hoje() - min(v.vencimento)  as dias_em_atraso
from beach.vw_mensalidades v
where v.vencida
group by v.aluno_id, v.aluno_nome;

-- Relatório mensal: previsto (competência) x recebido (caixa).
create view beach.vw_relatorio_mensal
with (security_invoker = true) as
with previsto as (
  select competencia as mes,
         sum(valor - desconto) filter (where status <> 'cancelada')       as previsto_mensalidades,
         count(*) filter (where status <> 'cancelada')                      as qtd_mensalidades,
         count(*) filter (where status = 'paga')                            as qtd_pagas
  from beach.mensalidades
  group by competencia
),
em_aberto as (
  select competencia as mes,
         sum(saldo) filter (where vencida) as inadimplente,
         sum(saldo) filter (where status = 'aberta') as em_aberto
  from beach.vw_mensalidades
  group by competencia
),
caixa as (
  select date_trunc('month', pago_em at time zone 'America/Sao_Paulo')::date as mes,
         sum(valor) filter (where mensalidade_id is not null) as recebido_mensalidades,
         sum(valor) filter (where locacao_id is not null)     as recebido_locacoes
  from beach.pagamentos
  group by 1
),
meses as (
  select mes from previsto union select mes from caixa
)
select
  meses.mes,
  coalesce(previsto.previsto_mensalidades, 0) as previsto_mensalidades,
  coalesce(previsto.qtd_mensalidades, 0)      as qtd_mensalidades,
  coalesce(previsto.qtd_pagas, 0)             as qtd_pagas,
  coalesce(em_aberto.em_aberto, 0)            as em_aberto,
  coalesce(em_aberto.inadimplente, 0)         as inadimplente,
  coalesce(caixa.recebido_mensalidades, 0)    as recebido_mensalidades,
  coalesce(caixa.recebido_locacoes, 0)        as recebido_locacoes,
  coalesce(caixa.recebido_mensalidades, 0) + coalesce(caixa.recebido_locacoes, 0) as total_recebido
from meses
left join previsto  using (mes)
left join em_aberto using (mes)
left join caixa     using (mes)
order by meses.mes;
comment on view beach.vw_relatorio_mensal is 'Por mês: previsto/em aberto pela competência das mensalidades; recebido pela data do pagamento (regime de caixa).';
