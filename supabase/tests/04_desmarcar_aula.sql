-- Aluno desmarca/remarca. Rodar como authenticator depois de 03_agenda_rpcs.sql.
\set QUIET 1
create or replace function pg_temp.esperar_erro(sql text, rotulo text) returns text language plpgsql as $f$
begin execute sql; return 'FALHOU (deveria dar erro): '||rotulo;
exception when others then return 'ok erro esperado: '||rotulo||' -> '||sqlerrm; end $f$;
set role authenticated;
-- recepção gera aulas futuras
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select beach.gerar_aulas(current_date + 7, current_date + 14) >= 0 as gerou;
select a.id as aula_futura from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome like 'BT%' and a.data > current_date + 6 order by a.data limit 1 \gset
select a.id as aula_passada from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome like 'BT%' and a.data='2026-11-23' \gset
select 'vagas antes (recepção)' t, beach.vagas_livres_aula(:'aula_futura');
-- aluno 1 (matriculado na BT)
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select beach.desmarcar_aula(:'aula_futura');
select 'desmarcou' t, status, observacao from beach.presencas where aula_id = :'aula_futura';
select 'vagas após desmarcar' t, beach.vagas_livres_aula(:'aula_futura');
select beach.desmarcar_aula(:'aula_futura');  -- idempotente
select pg_temp.esperar_erro(format('select beach.desmarcar_aula(%L)', :'aula_passada'), 'desmarcar aula passada');
-- recepção ocupa a vaga com aluno 2 (reposição)
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
insert into beach.presencas (aula_id, aluno_id, observacao) values (:'aula_futura', '00000000-0000-0000-0000-0000000000a2', 'Reposição/avulso');
select 'vagas após reposição' t, beach.vagas_livres_aula(:'aula_futura');
-- aluno 1 tenta remarcar: vaga ocupada
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.esperar_erro(format('select beach.remarcar_aula(%L)', :'aula_futura'), 'remarcar sem vaga');
-- recepção tira a reposição; aluno remarca
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
delete from beach.presencas where aula_id = :'aula_futura' and aluno_id = '00000000-0000-0000-0000-0000000000a2';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select beach.remarcar_aula(:'aula_futura');
select 'presenças após remarcar' t, count(*) from beach.presencas where aula_id = :'aula_futura';
-- aluno 2 não é da turma BT
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select pg_temp.esperar_erro(format('select beach.desmarcar_aula(%L)', :'aula_futura'), 'aluno de outra turma desmarca');
-- aluno não insere presença direto
select pg_temp.esperar_erro(format($$insert into beach.presencas (aula_id, aluno_id) values (%L, auth.uid())$$, :'aula_futura'), 'aluno insere presença direto');
