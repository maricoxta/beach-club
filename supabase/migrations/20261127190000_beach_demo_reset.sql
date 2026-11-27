-- =============================================================================
-- Reset do ambiente de demonstração (2026-11-27)
--
-- As contas demo.admin / demo.professor / demo.aluno (@example.com) são usadas
-- por quem avalia o projeto. O demo.admin pode alterar QUALQUER dado do clube,
-- então o reset é completo: uma "foto" do schema beach fica no schema
-- beach_demo e é restaurada por inteiro.
--
--   select beach.demo_tirar_foto();          -- grava a foto (estado atual)
--   select beach.demo_restaurar();           -- volta tudo para a foto
--   select beach.demo_restaurar('<senha>');  -- idem + redefine a senha das
--                                            -- contas demo e derruba sessões
--
-- ATENÇÃO: demo_restaurar apaga e regrava TODOS os dados do schema beach,
-- menos os perfis protegidos (beach.perfis_protegidos). Só faz sentido
-- enquanto o clube roda apenas com dados de teste.
--
-- Nenhuma das funções é exposta ao app: execute revogado de anon/authenticated.
-- Rode pelo SQL Editor do Supabase.
-- =============================================================================

create schema if not exists beach_demo;
revoke all on schema beach_demo from public, anon, authenticated;

-- Ordem respeitando as chaves estrangeiras (pais primeiro).
create or replace function beach.demo_tabelas()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'modalidades', 'niveis', 'quadras', 'perfis', 'planos', 'turmas', 'aulas',
    'matriculas', 'matricula_turmas', 'mensalidades', 'locacoes', 'pagamentos',
    'presencas', 'desmarcacoes_decididas', 'reposicoes', 'checkins', 'avisos_lidos',
    'avaliacoes_aula', 'avaliacoes_aula_feitas', 'avaliacoes_aluno', 'liberacoes_vagas',
    'conversas', 'mensagens', 'config_pix', 'parceiros', 'atividades'
  ]::text[];
$$;

-- Falha se surgir tabela nova no schema beach sem entrar na lista acima.
create or replace function beach.demo_confere_tabelas()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_faltando text;
begin
  select string_agg(c.relname, ', ') into v_faltando
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'beach' and c.relkind = 'r'
     and c.relname <> 'perfis_protegidos'
     and c.relname <> all (beach.demo_tabelas());
  if v_faltando is not null then
    raise exception 'Tabelas fora do reset de demo: %. Inclua em beach.demo_tabelas().', v_faltando;
  end if;
end;
$$;

create or replace function beach.demo_tirar_foto()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
  n bigint;
  v_resumo text := '';
begin
  perform beach.demo_confere_tabelas();
  foreach t in array beach.demo_tabelas() loop
    execute format('drop table if exists beach_demo.%I', t);
    if t = 'perfis' then
      execute 'create table beach_demo.perfis as
                 select * from beach.perfis
                  where id not in (select id from beach.perfis_protegidos)';
    else
      execute format('create table beach_demo.%I as select * from beach.%I', t, t);
    end if;
    execute format('select count(*) from beach_demo.%I', t) into n;
    v_resumo := v_resumo || t || '=' || n || ' ';
  end loop;
  return 'foto gravada: ' || v_resumo;
end;
$$;

create or replace function beach.demo_restaurar(p_senha text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tabelas text[] := beach.demo_tabelas();
  v_demo text[] := array['demo.admin@example.com', 'demo.professor@example.com', 'demo.aluno@example.com'];
  t text;
  v_cols text;
  i int;
  n bigint;
  v_resumo text := '';
begin
  perform beach.demo_confere_tabelas();
  if to_regclass('beach_demo.perfis') is null then
    raise exception 'Nenhuma foto gravada. Rode select beach.demo_tirar_foto();';
  end if;

  -- triggers de regra de negócio desligados só durante a restauração
  -- (as chaves estrangeiras continuam valendo; a ordem da lista garante a consistência)
  foreach t in array v_tabelas loop
    execute format('alter table beach.%I disable trigger user', t);
  end loop;

  -- apaga dos filhos para os pais
  for i in reverse array_length(v_tabelas, 1) .. 1 loop
    t := v_tabelas[i];
    if t = 'perfis' then
      delete from beach.perfis where id not in (select id from beach.perfis_protegidos);
    else
      execute format('delete from beach.%I', t);
    end if;
  end loop;

  -- regrava dos pais para os filhos (sem colunas geradas)
  foreach t in array v_tabelas loop
    select string_agg(format('%I', column_name), ', ' order by ordinal_position) into v_cols
      from information_schema.columns
     where table_schema = 'beach' and table_name = t and is_generated <> 'ALWAYS';
    execute format('insert into beach.%I (%s) overriding system value select %s from beach_demo.%I',
                   t, v_cols, v_cols, t);
    get diagnostics n = row_count;
    v_resumo := v_resumo || t || '=' || n || ' ';
  end loop;

  -- acerta sequências de colunas identity (ex.: mensagens.id)
  for t, v_cols in
    select c.table_name, c.column_name from information_schema.columns c
     where c.table_schema = 'beach' and c.is_identity = 'YES'
  loop
    execute format('select setval(pg_get_serial_sequence(%L, %L), greatest(coalesce(max(%I), 0), 1)) from beach.%I',
                   'beach.' || t, v_cols, v_cols, t);
  end loop;

  foreach t in array v_tabelas loop
    execute format('alter table beach.%I enable trigger user', t);
  end loop;

  if p_senha is not null then
    update auth.users
       set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')), updated_at = now()
     where email = any (v_demo);
    delete from auth.refresh_tokens where user_id in (select id::text from auth.users where email = any (v_demo));
    delete from auth.sessions where user_id in (select id from auth.users where email = any (v_demo));
    v_resumo := v_resumo || '| senha das contas demo redefinida e sessões encerradas';
  end if;

  return 'restaurado: ' || v_resumo;
end;
$$;

revoke all on function beach.demo_tabelas() from public, anon, authenticated;
revoke all on function beach.demo_confere_tabelas() from public, anon, authenticated;
revoke all on function beach.demo_tirar_foto() from public, anon, authenticated;
revoke all on function beach.demo_restaurar(text) from public, anon, authenticated;
