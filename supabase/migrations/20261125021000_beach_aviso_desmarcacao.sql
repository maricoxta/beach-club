-- =============================================================================
-- Beach club: a recepção é avisada quando um aluno desmarca e decide se libera a vaga
-- (depende de 20261125013000_beach_liberacao_vagas)
--
-- Pendente = desmarcação numa aula agendada que ainda não começou, sem decisão:
--   - "Liberar": aumenta a liberação da aula em 1 vaga (liberar_desmarcacao) ou a recepção
--     ajusta pelo formulário; qualquer liberação salva depois da desmarcação conta como decisão.
--   - "Não liberar": grava a decisão 'mantida' e o aviso some.
-- =============================================================================

create table beach.desmarcacoes_decididas (
  presenca_id  uuid primary key references beach.presencas (id) on delete cascade,
  decisao      text not null check (decisao in ('liberada', 'mantida')),
  decidido_por uuid references beach.perfis (id) on delete set null default auth.uid(),
  decidido_em  timestamptz not null default now()
);
alter table beach.desmarcacoes_decididas enable row level security;
revoke insert, update, delete on beach.desmarcacoes_decididas from authenticated;
create policy desmarcacoes_decididas_select on beach.desmarcacoes_decididas for select to authenticated
  using ((select beach.is_staff()));

create or replace function beach.desmarcacoes_pendentes()
returns table (
  presenca_id uuid, aula_id uuid, aluno text, desmarcada_em timestamptz, data date, hora_inicio time,
  hora_fim time, turma text, modalidade text, nivel text, professor text, vagas_livres integer,
  liberadas smallint, liberar_em timestamptz
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
  select pr.id, a.id, al.nome, pr.created_at, a.data, t.hora_inicio, t.hora_fim, t.nome, mo.nome, n.nome,
         coalesce(pa.nome, pt.nome), beach.calc_vagas_livres(a.id), l.vagas, l.liberar_em
  from beach.presencas pr
  join beach.perfis al on al.id = pr.aluno_id
  join beach.aulas a on a.id = pr.aula_id
  join beach.turmas t on t.id = a.turma_id
  join beach.modalidades mo on mo.id = t.modalidade_id
  join beach.niveis n on n.id = t.nivel_id
  left join beach.perfis pa on pa.id = a.professor_id
  left join beach.perfis pt on pt.id = t.professor_id
  left join beach.liberacoes_vagas l on l.aula_id = a.id
  where pr.observacao = 'Desmarcada pelo aluno'
    and a.status = 'agendada'
    and (a.data + t.hora_inicio) at time zone 'America/Sao_Paulo' > now() + interval '2 hours'
    and not exists (select 1 from beach.desmarcacoes_decididas d where d.presenca_id = pr.id)
    and (l.aula_id is null or l.updated_at < pr.created_at)
  order by pr.created_at desc;
end;
$$;
comment on function beach.desmarcacoes_pendentes() is 'Recepção: desmarcações ainda sem decisão (liberar a vaga ou não).';

create or replace function beach.contar_desmarcacoes_pendentes()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when beach.is_staff() then (select count(*)::integer from beach.desmarcacoes_pendentes()) else 0 end
$$;

-- "Liberar": +1 vaga na liberação da aula (agora, ou mantém o horário já agendado).
create or replace function beach.liberar_desmarcacao(p_presenca uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_aula uuid;
  v_lib  beach.liberacoes_vagas%rowtype;
begin
  if not beach.is_staff() then
    raise exception 'Apenas a recepção pode liberar vagas' using errcode = 'insufficient_privilege';
  end if;
  select aula_id into v_aula from beach.presencas where id = p_presenca and observacao = 'Desmarcada pelo aluno';
  if v_aula is null then
    raise exception 'O aluno remarcou esta aula ou a desmarcação não existe mais' using errcode = 'check_violation';
  end if;
  select * into v_lib from beach.liberacoes_vagas where aula_id = v_aula;
  perform beach.liberar_vagas(v_aula, coalesce(v_lib.vagas, 0) + 1,
    case when v_lib.liberar_em > now() then v_lib.liberar_em else null end);
  insert into beach.desmarcacoes_decididas (presenca_id, decisao) values (p_presenca, 'liberada')
  on conflict (presenca_id) do update set decisao = 'liberada', decidido_por = auth.uid(), decidido_em = now();
end;
$$;

create or replace function beach.manter_desmarcacao(p_presenca uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not beach.is_staff() then
    raise exception 'Apenas a recepção' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from beach.presencas where id = p_presenca and observacao = 'Desmarcada pelo aluno') then
    raise exception 'O aluno remarcou esta aula ou a desmarcação não existe mais' using errcode = 'check_violation';
  end if;
  insert into beach.desmarcacoes_decididas (presenca_id, decisao) values (p_presenca, 'mantida')
  on conflict (presenca_id) do update set decisao = 'mantida', decidido_por = auth.uid(), decidido_em = now();
end;
$$;

revoke execute on function beach.desmarcacoes_pendentes(), beach.contar_desmarcacoes_pendentes(),
  beach.liberar_desmarcacao(uuid), beach.manter_desmarcacao(uuid) from public, anon;
grant execute on function beach.desmarcacoes_pendentes(), beach.contar_desmarcacoes_pendentes(),
  beach.liberar_desmarcacao(uuid), beach.manter_desmarcacao(uuid) to authenticated, service_role;
