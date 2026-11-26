-- =============================================================================
-- Beach club: parceiros do clube e vouchers para alunos
--
-- A administração cadastra os parceiros (logo, descrição, benefício, código do
-- voucher, como usar, validade, link e contato). Alunos com perfil ativo veem só
-- os parceiros publicados e dentro da validade. Recepção vê tudo (para tirar
-- dúvidas no balcão) mas não altera. Professores e contas de outros apps não leem.
--
-- Logos: bucket público "beach-parceiros" (logo é material de divulgação, sem dado
-- pessoal). Só admin envia, troca ou apaga arquivos.
-- =============================================================================

create table beach.parceiros (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(btrim(nome)) between 1 and 80),
  categoria   text check (length(categoria) <= 40),
  descricao   text check (length(descricao) <= 600),
  beneficio   text check (length(beneficio) <= 200),
  codigo      text check (length(codigo) <= 60),
  como_usar   text check (length(como_usar) <= 600),
  validade    date,
  link        text check (link ~* '^https?://' and length(link) <= 300),
  contato     text check (length(contato) <= 120),
  endereco    text check (length(endereco) <= 200),
  logo_path   text check (length(logo_path) <= 200),
  ativo       boolean not null default false,
  ordem       smallint not null default 0,
  criado_por  uuid references beach.perfis (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Publicar exige o benefício preenchido (o aluno precisa saber o que ganha).
  constraint parceiros_publicado_com_beneficio check (not ativo or length(btrim(coalesce(beneficio, ''))) > 0)
);
comment on table beach.parceiros is 'Parceiros do clube e o voucher/benefício oferecido aos alunos.';
comment on column beach.parceiros.ativo is 'Publicado: aparece para os alunos (se dentro da validade).';
comment on column beach.parceiros.validade is 'Último dia em que o voucher vale (null = sem prazo).';

create index parceiros_lista_idx on beach.parceiros (ativo, ordem, nome);

create trigger parceiros_updated_at before update on beach.parceiros
  for each row execute function beach.tg_set_updated_at();

alter table beach.parceiros enable row level security;

create policy parceiros_select on beach.parceiros for select to authenticated
  using (
    (select beach.is_staff())
    or (
      (select beach.papel_atual()) = 'aluno'
      and ativo
      and (validade is null or validade >= beach.hoje())
    )
  );
create policy parceiros_insert on beach.parceiros for insert to authenticated
  with check ((select beach.is_admin()));
create policy parceiros_update on beach.parceiros for update to authenticated
  using ((select beach.is_admin())) with check ((select beach.is_admin()));
create policy parceiros_delete on beach.parceiros for delete to authenticated
  using ((select beach.is_admin()));

grant select, insert, update, delete on beach.parceiros to authenticated;

-- Exemplos citados pela Mari, como rascunho (não publicados): a administração
-- completa benefício, código e validade e publica.
insert into beach.parceiros (nome, ordem, ativo, criado_por) values
  ('JOOG', 1, false, null),
  ('Sushi Gourmet', 2, false, null);

-- -----------------------------------------------------------------------------
-- Storage: bucket público para os logos (só roda onde existe o schema storage).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'schema storage ausente: bucket de logos não criado (ambiente de teste)';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('beach-parceiros', 'beach-parceiros', true, 2097152,
          array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  execute $p$
    create policy beach_parceiros_logos_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'beach-parceiros' and (select beach.is_admin()))
  $p$;
  execute $p$
    create policy beach_parceiros_logos_update on storage.objects for update to authenticated
    using (bucket_id = 'beach-parceiros' and (select beach.is_admin()))
    with check (bucket_id = 'beach-parceiros' and (select beach.is_admin()))
  $p$;
  execute $p$
    create policy beach_parceiros_logos_delete on storage.objects for delete to authenticated
    using (bucket_id = 'beach-parceiros' and (select beach.is_admin()))
  $p$;
end;
$$;
