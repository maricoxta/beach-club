-- =============================================================================
-- Aluno pede locação avulsa de quadra pelo app.
-- - Novo status 'solicitada': pedido do aluno aguardando a recepção (bloqueia o horário
--   como qualquer locação não cancelada). Recepção aprova (-> confirmada) ou recusa (-> cancelada).
-- - beach.horarios_ocupados: horários ocupados por turma ou locação, sem dados de clientes,
--   para o aluno ver a disponibilidade (o RLS não deixa o aluno ler locações/aulas de outros).
-- - beach.solicitar_locacao / beach.cancelar_minha_locacao: RPCs do aluno (o RLS de
--   beach.locacoes continua só staff para insert/update).
-- Funções em plpgsql: o valor novo do enum só pode ser usado depois do commit desta migration.
-- =============================================================================

alter type beach.status_locacao add value if not exists 'solicitada' before 'reservada';

-- -----------------------------------------------------------------------------
-- Disponibilidade das quadras (qualquer usuário logado)
-- -----------------------------------------------------------------------------
create or replace function beach.horarios_ocupados(p_de date, p_ate date)
returns table (quadra_id uuid, data date, inicio_min integer, fim_min integer, tipo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Faça login para ver os horários';
  end if;
  if p_ate < p_de or p_ate - p_de > 31 then
    raise exception 'Período inválido (máximo de 31 dias)';
  end if;

  return query
  -- Turmas ativas no dia da semana, exceto quando a aula do dia foi cancelada (mesma regra de tg_locacoes_valida).
  select t.quadra_id, d::date,
         (extract(hour from t.hora_inicio) * 60 + extract(minute from t.hora_inicio))::integer,
         (extract(hour from t.hora_fim) * 60 + extract(minute from t.hora_fim))::integer,
         'aula'::text
  from generate_series(p_de, p_ate, interval '1 day') d
  join beach.turmas t on t.ativo and t.dia_semana = extract(isodow from d)
  where not exists (
    select 1 from beach.aulas a where a.turma_id = t.id and a.data = d::date and a.status = 'cancelada'
  )
  union all
  select l.quadra_id,
         (l.inicio at time zone 'America/Sao_Paulo')::date,
         (extract(hour from l.inicio at time zone 'America/Sao_Paulo') * 60
           + extract(minute from l.inicio at time zone 'America/Sao_Paulo'))::integer,
         (extract(epoch from (l.fim - date_trunc('day', l.inicio at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')) / 60)::integer,
         'locacao'::text
  from beach.locacoes l
  where l.status::text <> 'cancelada'
    and l.inicio >= p_de::timestamp at time zone 'America/Sao_Paulo'
    and l.inicio < (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo';
end;
$$;
comment on function beach.horarios_ocupados(date, date) is
  'Horários ocupados das quadras (aulas de turma e locações), sem dados de clientes. Minutos desde 0h no fuso do clube.';

-- -----------------------------------------------------------------------------
-- Aluno pede um horário
-- -----------------------------------------------------------------------------
create or replace function beach.solicitar_locacao(
  p_quadra uuid,
  p_data date,
  p_hora integer,
  p_horas integer,
  p_observacao text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_perfil beach.perfis;
  v_inicio timestamptz;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_id uuid;
begin
  select * into v_perfil from beach.perfis where id = v_uid;
  if v_perfil.id is null or v_perfil.papel <> 'aluno' or not v_perfil.ativo then
    raise exception 'Apenas alunos ativos podem pedir locação pelo app';
  end if;
  if not exists (select 1 from beach.quadras where id = p_quadra and ativo) then
    raise exception 'Quadra indisponível';
  end if;
  if p_horas is null or p_horas < 1 or p_horas > 4 then
    raise exception 'A locação pode ter de 1 a 4 horas';
  end if;
  if p_hora is null or p_hora < 6 or p_hora + p_horas > 23 then
    raise exception 'Horário fora do funcionamento (6h às 23h)';
  end if;
  if p_data > v_hoje + 30 then
    raise exception 'Pedidos podem ser feitos para os próximos 30 dias';
  end if;

  v_inicio := (p_data + make_time(p_hora, 0, 0)) at time zone 'America/Sao_Paulo';
  if v_inicio < now() + interval '2 hours' then
    raise exception 'Peça com pelo menos 2 horas de antecedência';
  end if;
  if (select count(*) from beach.locacoes
      where cliente_id = v_uid and status::text = 'solicitada' and inicio > now()) >= 2 then
    raise exception 'Você já tem 2 pedidos aguardando a recepção. Aguarde a resposta para pedir outro.';
  end if;

  -- Conflitos (outra locação ou turma) são barrados pela constraint e pelo trigger de beach.locacoes.
  insert into beach.locacoes (quadra_id, cliente_id, cliente_nome, cliente_telefone, inicio, fim, status, observacao, criado_por)
  values (p_quadra, v_uid, v_perfil.nome, v_perfil.telefone, v_inicio, v_inicio + make_interval(hours => p_horas),
          'solicitada'::text::beach.status_locacao, nullif(trim(p_observacao), ''), v_uid)
  returning id into v_id;
  return v_id;
exception
  when exclusion_violation then
    if sqlerrm like '%locacoes_sem_conflito%' then
      raise exception 'Esse horário acabou de ser reservado. Escolha outro.' using errcode = 'exclusion_violation';
    end if;
    raise;
end;
$$;
comment on function beach.solicitar_locacao(uuid, date, integer, integer, text) is
  'Aluno pede locação (status solicitada). Antecedência mínima 2h, até 30 dias, 1 a 4h, no máximo 2 pedidos pendentes.';

-- -----------------------------------------------------------------------------
-- Aluno cancela o próprio pedido/locação
-- -----------------------------------------------------------------------------
create or replace function beach.cancelar_minha_locacao(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_loc beach.locacoes;
begin
  select * into v_loc from beach.locacoes where id = p_id and cliente_id = auth.uid() for update;
  if v_loc.id is null then
    raise exception 'Locação não encontrada';
  end if;
  if v_loc.status::text = 'cancelada' then
    return;
  end if;
  if v_loc.status::text <> 'solicitada' and v_loc.inicio < now() + interval '2 hours' then
    raise exception 'O cancelamento pelo app vai até 2 horas antes. Fale com a recepção.';
  end if;
  if exists (select 1 from beach.pagamentos where locacao_id = p_id) then
    raise exception 'Essa locação já tem pagamento registrado. Fale com a recepção para cancelar.';
  end if;
  update beach.locacoes set status = 'cancelada' where id = p_id;
end;
$$;

revoke all on function beach.horarios_ocupados(date, date) from public, anon;
revoke all on function beach.solicitar_locacao(uuid, date, integer, integer, text) from public, anon;
revoke all on function beach.cancelar_minha_locacao(uuid) from public, anon;
grant execute on function beach.horarios_ocupados(date, date) to authenticated;
grant execute on function beach.solicitar_locacao(uuid, date, integer, integer, text) to authenticated;
grant execute on function beach.cancelar_minha_locacao(uuid) to authenticated;
