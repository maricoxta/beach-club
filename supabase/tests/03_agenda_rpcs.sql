\set QUIET 1
create or replace function pg_temp.esperar_erro(sql text, rotulo text) returns text language plpgsql as $f$
begin execute sql; return 'FALHOU (deveria dar erro): '||rotulo;
exception when others then return 'ok erro esperado: '||rotulo||' -> '||sqlerrm; end $f$;
set role authenticated;
select a.id as bt_aula from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome like 'BT%' and a.data='2026-12-07' \gset
-- prof Paulo
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select 'ocupacao' t, t.nome, o.ocupadas from beach.turmas_ocupacao() o join beach.turmas t on t.id=o.turma_id order by 2;
select 'alunos BT (prof)' t, string_agg(nome, ',') from beach.alunos_da_turma((select id from beach.turmas where nome like 'BT%'));
select pg_temp.esperar_erro($$select * from beach.alunos_da_turma((select id from beach.turmas where nome like 'Vôlei%'))$$, 'prof vê alunos de outra turma');
select 'chamada BT 23/11 (prof)' t, nome, matriculado, status from beach.lista_chamada((select a.id from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome like 'BT%' and a.data='2026-11-23'));
-- aluno
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select 'ocupacao (aluno)' t, count(*) from beach.turmas_ocupacao();
select pg_temp.esperar_erro($$select * from beach.lista_chamada((select id from beach.aulas limit 1))$$, 'aluno vê chamada');
-- recepção: reposição do aluno 2 na aula BT
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
insert into beach.presencas (aula_id, aluno_id) select a.id, '00000000-0000-0000-0000-0000000000a2' from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome like 'BT%' and a.data='2026-11-23';
select 'chamada BT 23/11 (recepção)' t, nome, matriculado, status from beach.lista_chamada((select a.id from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome like 'BT%' and a.data='2026-11-23'));
reset role; set role anon;
select pg_temp.esperar_erro($$select * from beach.turmas_ocupacao()$$, 'anon ocupacao');
