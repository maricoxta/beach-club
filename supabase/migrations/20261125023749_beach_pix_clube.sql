-- =============================================================================
-- Beach club: chave Pix do clube para gerar QR Code / copia e cola sem custo
--
-- Uma linha só (id = true). O app monta o "Pix copia e cola" (BR Code estático do
-- Banco Central) com o valor exato de cada mensalidade/locação. Não há provedor:
-- o dinheiro cai direto na conta do clube e a recepção confirma o pagamento.
-- A chave Pix é dado público (vai impressa no QR), por isso todo usuário logado lê;
-- só o admin altera.
-- =============================================================================

create table beach.config_pix (
  id             boolean primary key default true check (id),
  chave          text not null check (length(btrim(chave)) between 1 and 77),
  tipo_chave     text not null check (tipo_chave in ('cnpj', 'cpf', 'email', 'telefone', 'aleatoria')),
  nome_recebedor text not null check (length(btrim(nome_recebedor)) between 1 and 25),
  cidade         text not null check (length(btrim(cidade)) between 1 and 15),
  ativo          boolean not null default true,
  atualizado_por uuid references beach.perfis (id) on delete set null default auth.uid(),
  updated_at     timestamptz not null default now()
);
comment on table beach.config_pix is 'Chave Pix do clube (linha única) usada para gerar o QR Code de cada cobrança.';

create trigger config_pix_updated_at before update on beach.config_pix
  for each row execute function beach.tg_set_updated_at();

alter table beach.config_pix enable row level security;

create policy config_pix_select on beach.config_pix for select to authenticated
  using (true);
create policy config_pix_insert on beach.config_pix for insert to authenticated
  with check ((select beach.is_admin()));
create policy config_pix_update on beach.config_pix for update to authenticated
  using ((select beach.is_admin())) with check ((select beach.is_admin()));
create policy config_pix_delete on beach.config_pix for delete to authenticated
  using ((select beach.is_admin()));
