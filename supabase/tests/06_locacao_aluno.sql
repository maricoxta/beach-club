-- Aluno pede locação. Rodar como authenticator depois dos outros testes.
\set QUIET 1
create or replace function pg_temp.esperar_erro(sql text, rotulo text) returns text language plpgsql as $f$
begin execute sql; return 'FALHOU (deveria dar erro): '||rotulo;
exception when others then return 'ok erro esperado: '||rotulo||' -> '||sqlerrm; end $f$;
create or replace function pg_temp.esperar(obtido bigint, esperado bigint, rotulo text) returns text language sql as $f$
  select case when obtido = esperado then 'ok: ' else 'FALHOU: ' end || rotulo || ' (' || obtido || ')' $f$;
set role authenticated;
select id as q1 from beach.quadras where nome = 'Quadra 1' \gset
select (current_date + 5) as dia \gset
-- aluno 1 pede 2h às 20h
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select beach.solicitar_locacao(:'q1', :'dia', 20, 2, 'aniversário') as pedido \gset
select pg_temp.esperar(count(*), 1, 'aluno vê o próprio pedido') from beach.locacoes where status = 'solicitada';
select pg_temp.esperar(count(*), 1, 'valor da quadra copiado (2h x 80)') from beach.locacoes where id = :'pedido' and valor_total = 160;
select pg_temp.esperar(count(*), 1, 'horario ocupado aparece') from beach.horarios_ocupados(:'dia', :'dia') where tipo = 'locacao' and inicio_min = 1200 and fim_min = 1320;
-- aluno 2 tenta o mesmo horário e não vê o pedido do aluno 1
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select pg_temp.esperar_erro(format('select beach.solicitar_locacao(%L, %L, 21, 1)', :'q1', :'dia'), 'conflito com pedido pendente');
select pg_temp.esperar(count(*), 0, 'aluno 2 não lê locação do aluno 1') from beach.locacoes;
select pg_temp.esperar_erro(format('select beach.cancelar_minha_locacao(%L)', :'pedido'), 'cancelar pedido de outro aluno');
select pg_temp.esperar_erro(format('select beach.solicitar_locacao(%L, current_date - 1, 10, 1)', :'q1'), 'pedido no passado');
select pg_temp.esperar_erro(format('select beach.solicitar_locacao(%L, current_date + 40, 10, 1)', :'q1'), 'pedido além de 30 dias');
select pg_temp.esperar_erro(format('select beach.solicitar_locacao(%L, %L, 22, 2)', :'q1', :'dia'), 'passa das 23h');
select pg_temp.esperar_erro(format('select beach.solicitar_locacao(%L, %L, 10, 5)', :'q1', :'dia'), 'mais de 4 horas');
select pg_temp.esperar_erro(format($$insert into beach.locacoes (quadra_id, cliente_id, cliente_nome, inicio, fim) values (%L, auth.uid(), 'x', now() + interval '3 days', now() + interval '3 days 1 hour')$$, :'q1'), 'aluno insere direto');
-- limite de 2 pedidos pendentes
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select beach.solicitar_locacao(:'q1', :'dia', 8, 1) is not null as segundo;
select pg_temp.esperar_erro(format('select beach.solicitar_locacao(%L, %L, 15, 1)', :'q1', :'dia'), 'terceiro pedido pendente');
-- recepção aprova o primeiro e registra pagamento
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
update beach.locacoes set status = 'confirmada' where id = :'pedido';
insert into beach.pagamentos (locacao_id, valor, forma) values (:'pedido', 160, 'pix');
-- aluno não cancela locação paga, mas cancela o outro pedido
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.esperar_erro(format('select beach.cancelar_minha_locacao(%L)', :'pedido'), 'cancelar locação paga');
select id as segundo from beach.locacoes where status = 'solicitada' \gset
select beach.cancelar_minha_locacao(:'segundo');
select pg_temp.esperar(count(*), 1, 'segundo pedido cancelado') from beach.locacoes where id = :'segundo' and status = 'cancelada';
select pg_temp.esperar(count(*), 1, 'aluno vê pagamento da própria locação') from beach.pagamentos where locacao_id = :'pedido';
reset role;
