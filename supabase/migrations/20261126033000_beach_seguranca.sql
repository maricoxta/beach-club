-- =============================================================================
-- Revisão de segurança (2026-11-26)
--
-- 1. Avaliações de aula anônimas de fato: ninguém lê a tabela linha a linha
--    (o professor via data/turma de cada nota e cruzava com quem fez check-in).
--    Agora as notas saem só pela RPC avaliacoes_liberadas(), agrupadas por mês,
--    depois que o mês fecha (+7 dias do prazo de avaliação) e com pelo menos 3
--    avaliações do professor naquele mês. O resumo segue a mesma regra.
-- 2. Contas de outros apps (o auth.users é compartilhado) não leem nada do clube:
--    catálogo, chave Pix, professores e ocupação exigem perfil ativo no beach.
-- 3. Só admin dá ou tira o papel de recepção (recepção = acesso total ao clube).
-- 4. View de frequência sem permissão de escrita.
-- =============================================================================

-- ---------------------------------------------------------------- 1. avaliações anônimas
drop policy if exists avaliacoes_aula_select on beach.avaliacoes_aula;
revoke select on beach.avaliacoes_aula from authenticated;

-- Mês "liberado": já acabou e o prazo de 7 dias para avaliar as aulas dele passou.
create or replace function beach.avaliacoes_liberadas()
returns table (professor_id uuid, professor text, mes date, nota smallint, comentario text)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select av.professor_id, date_trunc('month', a.data)::date as mes, av.nota, av.comentario
    from beach.avaliacoes_aula av
    join beach.aulas a on a.id = av.aula_id
    where av.professor_id is not null
      and (beach.is_staff() or av.professor_id = (select auth.uid()))
  ), grupos as (
    select b.professor_id, b.mes
    from base b
    where (b.mes + interval '1 month' + interval '7 days')::date <= beach.hoje()
    group by b.professor_id, b.mes
    having count(*) >= 3
  )
  select b.professor_id, p.nome, b.mes, b.nota, b.comentario
  from base b
  join grupos g on g.professor_id = b.professor_id and g.mes = b.mes
  join beach.perfis p on p.id = b.professor_id
  -- ordem sem relação com a data ou a ordem em que as notas chegaram
  order by b.mes desc, p.nome, b.nota desc, b.comentario nulls last
$$;
comment on function beach.avaliacoes_liberadas() is
  'Notas anônimas das aulas, só de meses fechados (+7 dias) com 3 ou mais avaliações do professor. Staff vê todos; professor, as suas.';

drop function if exists beach.resumo_avaliacoes();
create function beach.resumo_avaliacoes()
returns table (professor_id uuid, professor text, avaliacoes integer, media numeric,
               mes_recente date, avaliacoes_mes integer, media_mes numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with l as (select * from beach.avaliacoes_liberadas()),
  ult as (select l.professor_id, max(l.mes) as mes from l group by l.professor_id)
  select l.professor_id, min(l.professor), count(*)::integer, round(avg(l.nota), 1),
         u.mes,
         count(*) filter (where l.mes = u.mes)::integer,
         round(avg(l.nota) filter (where l.mes = u.mes), 1)
  from l join ult u on u.professor_id = l.professor_id
  group by l.professor_id, u.mes
  order by 2
$$;

revoke execute on function beach.avaliacoes_liberadas(), beach.resumo_avaliacoes() from public, anon;
grant execute on function beach.avaliacoes_liberadas(), beach.resumo_avaliacoes() to authenticated, service_role;

-- ---------------------------------------------------------------- 2. só quem tem perfil no clube
drop policy if exists modalidades_select on beach.modalidades;
create policy modalidades_select on beach.modalidades for select to authenticated
  using ((select beach.papel_atual()) is not null);

drop policy if exists niveis_select on beach.niveis;
create policy niveis_select on beach.niveis for select to authenticated
  using ((select beach.papel_atual()) is not null);

drop policy if exists quadras_select on beach.quadras;
create policy quadras_select on beach.quadras for select to authenticated
  using ((select beach.papel_atual()) is not null);

drop policy if exists planos_select on beach.planos;
create policy planos_select on beach.planos for select to authenticated
  using ((select beach.papel_atual()) is not null);

drop policy if exists turmas_select on beach.turmas;
create policy turmas_select on beach.turmas for select to authenticated
  using ((select beach.papel_atual()) is not null);

drop policy if exists config_pix_select on beach.config_pix;
create policy config_pix_select on beach.config_pix for select to authenticated
  using ((select beach.papel_atual()) is not null);

drop policy if exists perfis_select on beach.perfis;
create policy perfis_select on beach.perfis for select to authenticated
  using (
    id = (select auth.uid())
    or (select beach.is_staff())
    or (papel = 'professor' and (select beach.papel_atual()) is not null)  -- nome do professor nas turmas
    or beach.professor_tem_aluno(id)
  );

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
    and beach.papel_atual() is not null
  group by mt.turma_id
$$;

create or replace function beach.horarios_ocupados(p_de date, p_ate date)
returns table (quadra_id uuid, data date, inicio_min integer, fim_min integer, tipo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if beach.papel_atual() is null then
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

-- ---------------------------------------------------------------- 3. papel de recepção só pelo admin
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
    if new.papel in ('admin', 'recepcao') and not beach.is_admin() then
      raise exception 'Apenas admin pode criar admin ou recepção' using errcode = 'insufficient_privilege';
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
    if (new.papel = 'recepcao' or old.papel = 'recepcao') and not beach.is_admin() then
      raise exception 'Apenas admin pode dar, tirar ou alterar o acesso da recepção' using errcode = 'insufficient_privilege';
    end if;
  end if;

  if new.id is distinct from old.id then
    raise exception 'O id do perfil não pode ser alterado';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------- 4. advisor
-- As funções do range faixa_horario (aviso do advisor) pertencem a supabase_admin e não
-- podem ser alteradas pelo SQL Editor. São construtores internos do tipo, sem código SQL,
-- então o search_path não abre brecha: o aviso pode ser ignorado.

revoke insert, update, delete on beach.vw_frequencia_resumo from authenticated;

-- ---------------------------------------------------------------- 5. cadastro pelo site aguarda aprovação
-- Decisão da Mari (2026-11-26): quem cria conta sozinho entra inativo e a recepção ativa.
-- O cadastro feito pela recepção (convite) ativa o perfil logo depois de enviar o link.
create or replace function beach.tg_auth_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'app', '') = 'beach-club' then
    insert into beach.perfis (id, papel, nome, email, telefone, ativo)
    values (
      new.id,
      'aluno',
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1), 'Aluno'),
      new.email,
      nullif(trim(new.raw_user_meta_data ->> 'telefone'), ''),
      false
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
