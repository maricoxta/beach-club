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

-- ===== Reposição e aula extra =====
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
insert into beach.turmas (nome, modalidade_id, nivel_id, professor_id, quadra_id, dia_semana, hora_inicio, hora_fim, vagas)
select 'BT Livre Sex 10h', modalidade_id, nivel_id, professor_id, (select id from beach.quadras where nome='Quadra 2'), 5, '10:00', '11:00', 5
from beach.turmas where nome like 'BT%' limit 1;
select beach.gerar_aulas(current_date + 1, current_date + 21) >= 0 as gerou2;
select a.id as livre1 from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome='BT Livre Sex 10h' and a.data > current_date + 1 order by a.data limit 1 \gset
select a.id as livre1b from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome='BT Livre Sex 10h' and a.data > current_date + 1 order by a.data offset 1 limit 1 \gset
-- o seed cria os planos depois da migration: configura a extra do 2x aqui
update beach.planos set aulas_extras_semana = 1 where nome = '2x';
select 'extras plano 2x' t, aulas_extras_semana from beach.planos where nome='2x';
-- a2 entra numa turma de BT Iniciante (só vê vaga do mesmo nível/modalidade)
insert into beach.turmas (nome, modalidade_id, nivel_id, professor_id, quadra_id, dia_semana, hora_inicio, hora_fim, vagas)
select 'BT Ter 7h', modalidade_id, nivel_id, professor_id, (select id from beach.quadras where nome='Quadra 2'), 2, '07:00', '08:00', 5
from beach.turmas where nome like 'BT Iniciante%' limit 1;
insert into beach.matricula_turmas select m.id, t.id from beach.matriculas m, beach.turmas t where m.aluno_id='00000000-0000-0000-0000-0000000000a2' and t.nome = 'BT Ter 7h';
-- recepção libera as vagas da turma livre
select beach.liberar_vagas(:'livre1', 5, null);
select beach.liberar_vagas(:'livre1b', 5, null);

-- aluno 2 (plano 2x, só no vôlei): usa a aula extra da semana
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select 'a2 vê vagas p/ extra' t, count(*) > 0 from beach.vagas_para_reposicao(current_date, current_date + 21) where aula_id = :'livre1';
select beach.reservar_reposicao(:'livre1') is not null as reservou_extra;
select 'tipo' t, tipo from beach.reposicoes where aula_reposicao_id = :'livre1';
select 'a2 vê a aula da reposição' t, count(*) from beach.aulas where id = :'livre1';
select pg_temp.esperar_erro(format('select beach.reservar_reposicao(%L)', :'livre1'), 'reservar 2x a mesma aula');
-- segunda extra na mesma semana: sem crédito
-- na semana seguinte ele tem outra extra
select beach.reservar_reposicao(:'livre1b') is not null as reservou_extra_semana_seguinte;
select beach.cancelar_reposicao(:'livre1b');
select beach.cancelar_reposicao(:'livre1');
select 'após cancelar' t, (select count(*) from beach.reposicoes where aluno_id = auth.uid()) reps, (select count(*) from beach.presencas where aula_id = :'livre1' and aluno_id = auth.uid()) pres;

-- aluno 1 (plano 1x, sem extra): precisa desmarcar para ganhar crédito
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select 'a1 sem crédito vê vagas' t, count(*) from beach.vagas_para_reposicao(current_date, current_date + 21);
select pg_temp.esperar_erro(format('select beach.reservar_reposicao(%L)', :'livre1'), 'reservar sem crédito');
select beach.desmarcar_aula(:'aula_futura');
select 'créditos a1' t, count(*) from beach.meus_creditos_reposicao();
select beach.reservar_reposicao(:'livre1') is not null as reservou_reposicao;
select 'tipo a1' t, tipo, aula_desmarcada_id = :'aula_futura' as credito_certo from beach.reposicoes where aula_reposicao_id = :'livre1' and aluno_id = auth.uid();
select 'créditos após usar' t, count(*) from beach.meus_creditos_reposicao();
select pg_temp.esperar_erro(format('select beach.remarcar_aula(%L)', :'aula_futura'), 'remarcar com crédito usado');
select beach.cancelar_reposicao(:'livre1');
select beach.remarcar_aula(:'aula_futura');
select 'a1 final' t, (select count(*) from beach.reposicoes where aluno_id = auth.uid()) reps, (select count(*) from beach.presencas where aluno_id = auth.uid() and aula_id in (:'livre1', :'aula_futura')) pres;
select pg_temp.esperar_erro($$insert into beach.reposicoes (aluno_id, tipo, aula_reposicao_id) select auth.uid(), 'extra', id from beach.aulas limit 1$$, 'aluno insere reposição direto');
