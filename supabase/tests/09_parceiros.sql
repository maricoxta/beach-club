-- Parceiros: admin escreve; recepção lê tudo; aluno ativo lê só publicados e válidos.
\set QUIET 1
create or replace function pg_temp.esperar_erro(sql text, rotulo text) returns text language plpgsql as $f$
begin execute sql; return 'FALHOU (deveria dar erro): '||rotulo;
exception when others then return 'ok erro esperado: '||rotulo||' -> '||sqlerrm; end $f$;
create or replace function pg_temp.conferir(ok boolean, rotulo text) returns text language sql as $f$
  select case when ok then 'ok: ' else 'FALHOU: ' end || rotulo $f$;
set role authenticated;
-- admin
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select pg_temp.conferir(count(*) = 2, 'admin vê os 2 rascunhos de exemplo') from beach.parceiros;
select pg_temp.esperar_erro($$update beach.parceiros set ativo = true where nome = 'JOOG'$$, 'publicar sem benefício');
select pg_temp.esperar_erro($$insert into beach.parceiros (nome, link) values ('X', 'javascript:alert(1)')$$, 'link sem http');
update beach.parceiros set beneficio = 'Benefício teste', codigo = 'CRISTAL', ativo = true where nome = 'JOOG';
insert into beach.parceiros (nome, beneficio, ativo, validade) values ('Vencido', 'b', true, beach.hoje() - 1);
-- recepção lê tudo, não altera
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select pg_temp.conferir(count(*) = 3, 'recepção vê todos') from beach.parceiros;
select pg_temp.esperar_erro($$insert into beach.parceiros (nome) values ('R')$$, 'recepção cadastra');
update beach.parceiros set codigo = 'X';
-- aluno
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.conferir(count(*) = 1 and min(codigo) = 'CRISTAL', 'aluno vê só o publicado e válido; recepção não alterou') from beach.parceiros;
update beach.parceiros set codigo = 'golpe';
select pg_temp.esperar_erro($$insert into beach.parceiros (nome) values ('A')$$, 'aluno cadastra');
-- professor e conta de outro app não veem
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select pg_temp.conferir(count(*) = 0, 'professor não vê') from beach.parceiros;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}';
select pg_temp.conferir(count(*) = 0, 'conta de outro app não vê') from beach.parceiros;
-- aluno inativo não vê
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
update beach.perfis set ativo = false where id = '00000000-0000-0000-0000-0000000000a2';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select pg_temp.conferir(count(*) = 0, 'aluno inativo não vê') from beach.parceiros;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
update beach.perfis set ativo = true where id = '00000000-0000-0000-0000-0000000000a2';
-- limpa
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select pg_temp.conferir(codigo = 'CRISTAL', 'aluno não alterou') from beach.parceiros where nome = 'JOOG';
delete from beach.parceiros where nome = 'Vencido';
update beach.parceiros set ativo = false, beneficio = null, codigo = null;
