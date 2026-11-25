-- =============================================================================
-- Beach club: chat entre aluno e administração/recepção
--
-- Regras:
--   - Uma conversa por aluno (chave = aluno_id). A equipe (admin + recepção) responde
--     como "Recepção": qualquer pessoa da equipe vê e responde todas as conversas.
--   - O aluno só lê a própria conversa (RLS). Professor não participa.
--   - Envio e leitura só pelas RPCs (insert/update direto revogados).
--   - "Lida" é por lado: aluno_leu_em (aluno) e equipe_leu_em (equipe, compartilhado:
--     se alguém da recepção abriu, conta como lida para toda a equipe).
--   - Realtime: beach.mensagens entra na publicação supabase_realtime; o Realtime
--     respeita o RLS, então cada aluno só recebe as próprias mensagens.
-- =============================================================================

create table beach.conversas (
  aluno_id           uuid primary key references beach.perfis (id) on delete cascade,
  ultima_mensagem_em timestamptz not null default now(),
  aluno_leu_em       timestamptz,
  equipe_leu_em      timestamptz,
  created_at         timestamptz not null default now()
);
comment on table beach.conversas is 'Chat aluno <-> recepção: uma conversa por aluno, com quando cada lado leu.';
create index conversas_ultima_idx on beach.conversas (ultima_mensagem_em desc);

create table beach.mensagens (
  id         bigint generated always as identity primary key,
  aluno_id   uuid not null references beach.conversas (aluno_id) on delete cascade,
  autor_id   uuid references beach.perfis (id) on delete set null,
  da_equipe  boolean not null,
  texto      text not null check (char_length(btrim(texto)) between 1 and 2000),
  created_at timestamptz not null default now()
);
comment on table beach.mensagens is 'Mensagens do chat. da_equipe = enviada pela recepção/admin.';
create index mensagens_conversa_idx on beach.mensagens (aluno_id, created_at desc);

alter table beach.conversas enable row level security;
alter table beach.mensagens enable row level security;
revoke insert, update, delete on beach.conversas, beach.mensagens from authenticated;

create policy conversas_select on beach.conversas for select to authenticated
  using (aluno_id = (select auth.uid()) or (select beach.is_staff()));
create policy mensagens_select on beach.mensagens for select to authenticated
  using (aluno_id = (select auth.uid()) or (select beach.is_staff()));

-- Envia uma mensagem. Aluno: p_aluno é ignorado (vai para a própria conversa).
-- Equipe: p_aluno obrigatório (conversa com aquele aluno). Cria a conversa se preciso.
create or replace function beach.enviar_mensagem(p_texto text, p_aluno uuid default null)
returns beach.mensagens
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select auth.uid());
  v_papel beach.papel := beach.papel_atual();
  v_equipe boolean;
  v_aluno uuid;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_msg beach.mensagens;
begin
  if v_eu is null or v_papel is null then
    raise exception 'Faça login para enviar mensagens.' using errcode = '42501';
  end if;
  v_equipe := v_papel in ('admin', 'recepcao');
  if v_equipe then
    if p_aluno is null then
      raise exception 'Escolha o aluno da conversa.' using errcode = '22023';
    end if;
    if not exists (select 1 from beach.perfis where id = p_aluno and papel = 'aluno') then
      raise exception 'Aluno não encontrado.' using errcode = '22023';
    end if;
    v_aluno := p_aluno;
  elsif v_papel = 'aluno' then
    v_aluno := v_eu;
  else
    raise exception 'Só alunos e a recepção usam o chat.' using errcode = '42501';
  end if;
  if char_length(v_texto) = 0 then
    raise exception 'Escreva uma mensagem.' using errcode = '22023';
  end if;
  if char_length(v_texto) > 2000 then
    raise exception 'Mensagem muito longa (máximo 2000 caracteres).' using errcode = '22023';
  end if;

  insert into beach.conversas as c (aluno_id, ultima_mensagem_em, aluno_leu_em, equipe_leu_em)
  values (v_aluno, now(), case when v_equipe then null else now() end, case when v_equipe then now() else null end)
  on conflict (aluno_id) do update
    set ultima_mensagem_em = now(),
        aluno_leu_em  = case when v_equipe then c.aluno_leu_em else now() end,
        equipe_leu_em = case when v_equipe then now() else c.equipe_leu_em end;

  insert into beach.mensagens (aluno_id, autor_id, da_equipe, texto)
  values (v_aluno, v_eu, v_equipe, v_texto)
  returning * into v_msg;
  return v_msg;
end
$$;

-- Marca a conversa como lida pelo lado de quem chama.
create or replace function beach.marcar_conversa_lida(p_aluno uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if beach.is_staff() then
    update beach.conversas set equipe_leu_em = now() where aluno_id = p_aluno;
  elsif beach.papel_atual() = 'aluno' then
    update beach.conversas set aluno_leu_em = now() where aluno_id = (select auth.uid());
  end if;
end
$$;

-- Badge do menu. Aluno: respostas da recepção não lidas. Equipe: mensagens de alunos não lidas.
create or replace function beach.contar_mensagens_nao_lidas()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when beach.is_staff() then (
      select count(*)::integer from beach.mensagens m
      join beach.conversas c on c.aluno_id = m.aluno_id
      where not m.da_equipe and m.created_at > coalesce(c.equipe_leu_em, '-infinity'))
    when beach.papel_atual() = 'aluno' then (
      select count(*)::integer from beach.mensagens m
      join beach.conversas c on c.aluno_id = m.aluno_id
      where m.aluno_id = (select auth.uid()) and m.da_equipe
        and m.created_at > coalesce(c.aluno_leu_em, '-infinity'))
    else 0
  end
$$;

-- Caixa de entrada da equipe: conversas com a última mensagem e quantas não lidas.
create or replace function beach.caixa_mensagens()
returns table (
  aluno_id uuid,
  aluno text,
  email text,
  ultima_mensagem_em timestamptz,
  ultima_texto text,
  ultima_da_equipe boolean,
  nao_lidas integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not beach.is_staff() then
    raise exception 'Só a recepção vê a caixa de mensagens.' using errcode = '42501';
  end if;
  return query
  select c.aluno_id, p.nome, p.email, c.ultima_mensagem_em, u.texto, u.da_equipe,
         (select count(*)::integer from beach.mensagens m
           where m.aluno_id = c.aluno_id and not m.da_equipe
             and m.created_at > coalesce(c.equipe_leu_em, '-infinity'))
  from beach.conversas c
  join beach.perfis p on p.id = c.aluno_id
  left join lateral (
    select m.texto, m.da_equipe from beach.mensagens m
    where m.aluno_id = c.aluno_id order by m.created_at desc, m.id desc limit 1
  ) u on true
  order by c.ultima_mensagem_em desc;
end
$$;

revoke execute on function beach.enviar_mensagem(text, uuid), beach.marcar_conversa_lida(uuid),
  beach.contar_mensagens_nao_lidas(), beach.caixa_mensagens() from public, anon;
grant execute on function beach.enviar_mensagem(text, uuid), beach.marcar_conversa_lida(uuid),
  beach.contar_mensagens_nao_lidas(), beach.caixa_mensagens() to authenticated, service_role;

-- Realtime (só existe no Supabase; o teste local em Postgres puro pula).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table beach.mensagens;
  end if;
end
$$;
