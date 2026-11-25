-- Chave Pix do clube: todos leem, só admin altera.
\set QUIET 1
create or replace function pg_temp.esperar_erro(sql text, rotulo text) returns text language plpgsql as $f$
begin execute sql; return 'FALHOU (deveria dar erro): '||rotulo;
exception when others then return 'ok erro esperado: '||rotulo||' -> '||sqlerrm; end $f$;
create or replace function pg_temp.conferir(ok boolean, rotulo text) returns text language sql as $f$
  select case when ok then 'ok: ' else 'FALHOU: ' end || rotulo $f$;
set role authenticated;
-- recepção não cadastra
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select pg_temp.esperar_erro($$insert into beach.config_pix (chave, tipo_chave, nome_recebedor, cidade) values ('12345678000199','cnpj','CRISTAL','RIO')$$, 'recepção cadastra chave');
-- admin cadastra
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into beach.config_pix (chave, tipo_chave, nome_recebedor, cidade) values ('12345678000199','cnpj','CRISTAL BEACH CLUB','RIO DE JANEIRO');
select pg_temp.esperar_erro($$insert into beach.config_pix (chave, tipo_chave, nome_recebedor, cidade) values ('x','email','X','Y')$$, 'só uma linha');
select pg_temp.esperar_erro($$update beach.config_pix set nome_recebedor = repeat('a', 26)$$, 'nome acima de 25');
-- aluno lê mas não altera
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.conferir(count(*) = 1, 'aluno lê a chave') from beach.config_pix;
update beach.config_pix set chave = 'golpe@x';
select pg_temp.conferir(chave = '12345678000199', 'aluno não altera') from beach.config_pix;
-- limpa
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
delete from beach.config_pix;
