-- Calendário de frequência: aluno vê/mexe só no que é dele; staff lê; professor não vê.
\set QUIET 1
create or replace function pg_temp.esperar_erro(sql text, rotulo text) returns text language plpgsql as $f$
begin execute sql; return 'FALHOU (deveria dar erro): '||rotulo;
exception when others then return 'ok erro esperado: '||rotulo||' -> '||sqlerrm; end $f$;
create or replace function pg_temp.esperar(valor bigint, esperado bigint, rotulo text) returns text language sql as $f$
select case when valor = esperado then 'ok '||rotulo else 'FALHOU '||rotulo||': veio '||valor||', esperado '||esperado end $f$;
set role authenticated;
-- aluno 1 registra duas atividades no mesmo dia e uma em outro
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into beach.atividades (data, tipo, duracao_min, distancia_km, calorias, passos, foto_path)
values ('2026-11-20','aula_beach_tenis',60,2.5,450,4000,'00000000-0000-0000-0000-0000000000a1/x.jpg'),
       ('2026-11-20','play_futvolei',90,null,700,null,null),
       ('2026-11-21','play_volei',45,null,null,null,null);
select pg_temp.esperar_erro($$insert into beach.atividades (aluno_id, data, tipo) values ('00000000-0000-0000-0000-0000000000a2','2026-11-20','play_volei')$$, 'registrar para outro aluno');
select pg_temp.esperar_erro($$insert into beach.atividades (data, tipo, foto_path) values ('2026-11-20','play_volei','00000000-0000-0000-0000-0000000000a2/y.jpg')$$, 'foto na pasta de outro aluno');
select pg_temp.esperar_erro($$insert into beach.atividades (data, tipo) values ('2030-01-01','play_volei')$$, 'check-in no futuro');
select pg_temp.esperar_erro($$insert into beach.atividades (data, tipo, duracao_min) values ('2026-11-20','play_volei',0)$$, 'duração zero');
select pg_temp.esperar(checkins, 3, 'resumo checkins') from beach.vw_frequencia_resumo;
select pg_temp.esperar(dias_ativos, 2, 'resumo dias ativos') from beach.vw_frequencia_resumo;
select pg_temp.esperar(duracao_min, 195, 'resumo duração') from beach.vw_frequencia_resumo;
-- aluno 2 não vê nem apaga as do aluno 1
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select pg_temp.esperar(count(*), 0, 'aluno 2 não vê atividades do aluno 1') from beach.atividades;
with d as (delete from beach.atividades returning 1) select pg_temp.esperar(count(*), 0, 'aluno 2 não apaga') from d;
-- professor não vê
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select pg_temp.esperar(count(*), 0, 'professor não vê') from beach.atividades;
select pg_temp.esperar_erro($$insert into beach.atividades (data, tipo) values ('2026-11-20','play_volei')$$, 'professor não registra');
-- recepção lê tudo, mas não edita
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select pg_temp.esperar(count(*), 3, 'recepção vê') from beach.atividades;
with u as (update beach.atividades set calorias = 1 returning 1) select pg_temp.esperar(count(*), 0, 'recepção não edita') from u;
-- aluno 1 apaga a própria
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
with d as (delete from beach.atividades where tipo = 'play_volei' returning 1) select pg_temp.esperar(count(*), 1, 'aluno apaga a própria') from d;
