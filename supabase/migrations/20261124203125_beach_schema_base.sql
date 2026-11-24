-- =============================================================================
-- Beach club: schema base, tipos e cadastros
-- Tudo fica no schema "beach". O schema public NÃO é alterado.
-- =============================================================================

create schema if not exists beach;
comment on schema beach is 'Sistema do beach club: aulas, alunos, financeiro e locações.';

-- Necessária para a constraint de exclusão (sem sobreposição de horários).
create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type beach.papel as enum ('admin', 'recepcao', 'professor', 'aluno');
create type beach.status_matricula as enum ('ativa', 'pausada', 'cancelada');
create type beach.status_aula as enum ('agendada', 'realizada', 'cancelada');
create type beach.status_presenca as enum ('presente', 'falta', 'falta_justificada');
create type beach.status_mensalidade as enum ('aberta', 'paga', 'cancelada');
create type beach.forma_pagamento as enum ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'transferencia');
create type beach.status_locacao as enum ('reservada', 'confirmada', 'concluida', 'cancelada');

-- -----------------------------------------------------------------------------
-- Função genérica de updated_at
-- -----------------------------------------------------------------------------
create or replace function beach.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table beach.perfis (
  id              uuid primary key references auth.users (id) on delete cascade,
  papel           beach.papel not null default 'aluno',
  nome            text not null check (length(trim(nome)) > 0),
  email           text,
  telefone        text,
  data_nascimento date,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table beach.perfis is 'Usuários do beach club (admin, recepção, professor, aluno), ligados a auth.users.';
create index perfis_papel_idx on beach.perfis (papel);
create trigger perfis_updated_at before update on beach.perfis
  for each row execute function beach.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Modalidades (beach tênis, vôlei de praia...)
-- -----------------------------------------------------------------------------
create table beach.modalidades (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  descricao  text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger modalidades_updated_at before update on beach.modalidades
  for each row execute function beach.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Níveis (iniciante, intermediário, avançado...)
-- -----------------------------------------------------------------------------
create table beach.niveis (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  ordem      smallint not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger niveis_updated_at before update on beach.niveis
  for each row execute function beach.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Quadras
-- -----------------------------------------------------------------------------
create table beach.quadras (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  descricao  text,
  valor_hora numeric(10, 2) not null default 0 check (valor_hora >= 0),  -- preço da locação avulsa
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger quadras_updated_at before update on beach.quadras
  for each row execute function beach.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Planos (1x, 2x, 3x por semana)
-- -----------------------------------------------------------------------------
create table beach.planos (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null unique,
  aulas_por_semana smallint not null check (aulas_por_semana between 1 and 7),
  valor_mensal     numeric(10, 2) not null check (valor_mensal >= 0),
  modalidade_id    uuid references beach.modalidades (id),  -- null = vale para qualquer modalidade
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger planos_updated_at before update on beach.planos
  for each row execute function beach.tg_set_updated_at();
