-- =============================================================================
-- Beach club: calendário de frequência do aluno (check-ins de atividades)
--
-- O aluno registra uma ou mais atividades por dia (aula ou play), com foto
-- opcional e métricas do relógio/app (duração, distância, calorias, passos).
-- Independe da chamada do professor (beach.presencas): é um diário do aluno.
--
-- Visões: aluno -> só os próprios registros (cria, edita, apaga);
--         admin/recepção -> leem todos (acompanhamento); professor não vê.
-- Fotos: bucket privado "beach-atividades", caminho "<aluno_id>/<arquivo>".
-- =============================================================================

create type beach.tipo_atividade as enum (
  'aula_beach_tenis',
  'aula_volei',
  'play_beach_tenis',
  'play_volei',
  'play_futvolei'
);

create table beach.atividades (
  id            uuid primary key default gen_random_uuid(),
  aluno_id      uuid not null default auth.uid() references beach.perfis (id) on delete cascade,
  data          date not null default beach.hoje(),
  tipo          beach.tipo_atividade not null,
  duracao_min   integer check (duracao_min between 1 and 1440),
  distancia_km  numeric(6, 2) check (distancia_km >= 0 and distancia_km <= 500),
  calorias      integer check (calorias between 0 and 20000),
  passos        integer check (passos between 0 and 200000),
  foto_path     text constraint atividades_foto_na_pasta_do_aluno check (foto_path is null or foto_path like aluno_id::text || '/%'),
  observacao    text check (char_length(observacao) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Não aceita check-in no futuro (margem de 1 dia para fuso).
  constraint atividades_data_nao_futura check (data <= (now() at time zone 'America/Sao_Paulo')::date + 1)
);
comment on table beach.atividades is 'Check-ins de atividades do aluno (calendário de frequência).';

create index atividades_aluno_data_idx on beach.atividades (aluno_id, data);
create trigger atividades_updated_at before update on beach.atividades
  for each row execute function beach.tg_set_updated_at();

-- Grants seguem o padrão do schema (RLS decide o que cada um vê).
revoke all on beach.atividades from public, anon;
grant select, insert, update, delete on beach.atividades to authenticated;
grant all on beach.atividades to service_role;

alter table beach.atividades enable row level security;

create policy atividades_select on beach.atividades for select to authenticated
  using (aluno_id = (select auth.uid()) or (select beach.is_staff()));
-- Só quem tem perfil de aluno registra, e sempre para si mesmo.
create policy atividades_insert on beach.atividades for insert to authenticated
  with check (aluno_id = (select auth.uid()) and (select beach.papel_atual()) = 'aluno');
create policy atividades_update on beach.atividades for update to authenticated
  using (aluno_id = (select auth.uid()))
  with check (aluno_id = (select auth.uid()));
create policy atividades_delete on beach.atividades for delete to authenticated
  using (aluno_id = (select auth.uid()) or (select beach.is_admin()));

-- Resumo para o topo do calendário (check-ins, dias ativos, duração total).
-- security_invoker: respeita o RLS de quem consulta.
create view beach.vw_frequencia_resumo
with (security_invoker = true) as
select
  aluno_id,
  count(*)                          as checkins,
  count(distinct data)              as dias_ativos,
  coalesce(sum(duracao_min), 0)     as duracao_min,
  coalesce(sum(distancia_km), 0)    as distancia_km,
  coalesce(sum(calorias), 0)        as calorias,
  coalesce(sum(passos), 0)          as passos
from beach.atividades
group by aluno_id;

revoke all on beach.vw_frequencia_resumo from public, anon;
grant select on beach.vw_frequencia_resumo to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Storage: bucket privado para as fotos (só roda onde existe o schema storage,
-- ou seja, no Supabase; nos testes locais com Postgres puro é ignorado).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'schema storage ausente: bucket de fotos não criado (ambiente de teste)';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('beach-atividades', 'beach-atividades', false, 5242880,
          array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
  on conflict (id) do nothing;

  -- Pasta = id do aluno. O aluno mexe só na própria pasta; admin/recepção leem.
  execute $p$
    create policy beach_atividades_fotos_select on storage.objects for select to authenticated
    using (
      bucket_id = 'beach-atividades'
      and ((storage.foldername(name))[1] = (select auth.uid())::text or (select beach.is_staff()))
    )
  $p$;
  execute $p$
    create policy beach_atividades_fotos_insert on storage.objects for insert to authenticated
    with check (
      bucket_id = 'beach-atividades'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  $p$;
  execute $p$
    create policy beach_atividades_fotos_update on storage.objects for update to authenticated
    using (bucket_id = 'beach-atividades' and (storage.foldername(name))[1] = (select auth.uid())::text)
    with check (bucket_id = 'beach-atividades' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
  execute $p$
    create policy beach_atividades_fotos_delete on storage.objects for delete to authenticated
    using (bucket_id = 'beach-atividades' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
end;
$$;
