-- Check-in, avaliação mensal do aluno e avaliação anônima da aula. Rodar depois de 08.
\set QUIET 1
create or replace function pg_temp.esperar_erro(sql text, rotulo text) returns text language plpgsql as $f$
begin execute sql; return 'FALHOU (deveria dar erro): '||rotulo;
exception when others then return 'ok erro esperado: '||rotulo||' -> '||sqlerrm; end $f$;
create or replace function pg_temp.conferir(ok boolean, rotulo text) returns text language sql as $f$
  select case when ok then 'ok: ' else 'FALHOU: ' end || rotulo $f$;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select a.id as fut from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome = 'BT Iniciante Seg 18h' and a.status = 'agendada' and a.data > current_date + 2 order by a.data limit 1 \gset
select a.id as passada from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome = 'BT Iniciante Seg 18h' and a.data < current_date and a.data >= current_date - 7 order by a.data desc limit 1 \gset
select t.professor_id::text as prof from beach.turmas t where t.nome = 'BT Iniciante Seg 18h' \gset
select id as nivel_d from beach.niveis where nome = 'Nível D' \gset
-- garante que a aula passada não tem presença de a1 (participou = matriculado)
delete from beach.presencas where aula_id = :'passada' and aluno_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');

-- ===== check-in =====
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select beach.fazer_checkin(:'fut');
select beach.fazer_checkin(:'fut');  -- idempotente
select pg_temp.conferir(count(*) = 1, 'a1 fez check-in') from beach.checkins where aula_id = :'fut';
select pg_temp.esperar_erro(format('select beach.fazer_checkin(%L)', :'passada'), 'check-in em aula passada');
select pg_temp.esperar_erro(format($$insert into beach.checkins (aula_id, aluno_id) values (%L, auth.uid())$$, :'fut'), 'aluno insere check-in direto');
select pg_temp.esperar_erro(format('select * from beach.lista_checkin(%L)', :'fut'), 'aluno vê lista de check-in');
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select pg_temp.esperar_erro(format('select beach.fazer_checkin(%L)', :'fut'), 'aluno de outra turma faz check-in');
select pg_temp.conferir(count(*) = 0, 'a2 não vê check-in de a1') from beach.checkins where aula_id = :'fut';

-- professor vê a lista
select set_config('request.jwt.claims', json_build_object('sub', :'prof', 'role', 'authenticated')::text, false) is not null as prof_on;
select pg_temp.conferir(situacao = 'confirmado' and tipo = 'turma', 'professor vê a1 confirmado') from beach.lista_checkin(:'fut') where aluno_id = '00000000-0000-0000-0000-0000000000a1';
-- a1 desmarca: vira desmarcou
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select beach.desmarcar_aula(:'fut');
select pg_temp.esperar_erro(format('select beach.fazer_checkin(%L)', :'fut'), 'check-in depois de desmarcar');
select set_config('request.jwt.claims', json_build_object('sub', :'prof', 'role', 'authenticated')::text, false) is not null as prof_on;
select pg_temp.conferir(situacao = 'desmarcou', 'desmarcação prevalece') from beach.lista_checkin(:'fut') where aluno_id = '00000000-0000-0000-0000-0000000000a1';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select beach.remarcar_aula(:'fut');
select beach.desfazer_checkin(:'fut');
select pg_temp.conferir(count(*) = 0, 'desfez check-in') from beach.checkins where aula_id = :'fut';

-- ===== avaliação mensal do aluno =====
select t.id as turma from beach.turmas t where t.nome = 'BT Iniciante Seg 18h' \gset
select pg_temp.esperar_erro(format('select beach.avaliar_aluno(auth.uid(), %L, 5, %L)', :'turma', 'Me dou cinco estrelas, claro!'), 'aluno se avalia');
select set_config('request.jwt.claims', json_build_object('sub', :'prof', 'role', 'authenticated')::text, false) is not null as prof_on;
select pg_temp.conferir(nota_mes is null and pode_editar, 'a1 pendente no mês para o professor') from beach.alunos_para_avaliar() where aluno_id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.esperar_erro(format('select beach.avaliar_aluno(%L, %L, 5, %L)', '00000000-0000-0000-0000-0000000000a1', :'turma', 'Bom'), 'comentário curto');
select pg_temp.esperar_erro(format('select beach.avaliar_aluno(%L, %L, 6, %L)', '00000000-0000-0000-0000-0000000000a1', :'turma', 'Comentário com bastante fundamento'), 'nota 6');
select beach.avaliar_aluno('00000000-0000-0000-0000-0000000000a1', :'turma', 4, 'Saque consistente, falta posicionamento na rede.') is not null as avaliou;
select pg_temp.conferir(ultima_nota = 4, 'lista de check-in mostra a última nota') from beach.lista_checkin(:'fut') where aluno_id = '00000000-0000-0000-0000-0000000000a1';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select pg_temp.esperar_erro(format('select beach.avaliar_aluno(%L, %L, 5, %L)', '00000000-0000-0000-0000-0000000000a1', :'turma', 'Outro professor avaliando aqui'), 'professor de outra turma avalia');
select pg_temp.conferir(count(*) = 0, 'outro professor não lê a avaliação') from beach.avaliacoes_aluno;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.conferir(count(*) = 1 and min(nota) = 4, 'aluno lê a própria avaliação') from beach.avaliacoes_aluno;
select pg_temp.esperar_erro($$update beach.avaliacoes_aluno set nota = 5$$, 'aluno altera avaliação'), (select nota from beach.avaliacoes_aluno limit 1) = 4 as continua_4;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select pg_temp.conferir(count(*) = 0, 'a2 não lê avaliação de a1') from beach.avaliacoes_aluno;

-- trava de nível: subir para Nível D exige 5 estrelas
create or replace function pg_temp.erro_de(sql text) returns text language plpgsql as $f$
begin execute sql; return 'sem erro'; exception when others then return sqlerrm; end $f$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
insert into beach.turmas (nome, modalidade_id, nivel_id, professor_id, quadra_id, dia_semana, hora_inicio, hora_fim, vagas)
select 'BT Nível D Qua 21h', modalidade_id, :'nivel_d', professor_id, quadra_id, 3, '21:00', '22:00', 5 from beach.turmas where id = :'turma';
select id as turma_d from beach.turmas where nome = 'BT Nível D Qua 21h' \gset
select id as mat_a1 from beach.matriculas where aluno_id = '00000000-0000-0000-0000-0000000000a1' and status = 'ativa' limit 1 \gset
select pg_temp.conferir(pg_temp.erro_de(format('insert into beach.matricula_turmas values (%L, %L)', :'mat_a1', :'turma_d')) like '%subir de nível%(a última foi 4)%', 'nota 4 não sobe de nível');
select set_config('request.jwt.claims', json_build_object('sub', :'prof', 'role', 'authenticated')::text, false) is not null as prof_on;
select beach.avaliar_aluno('00000000-0000-0000-0000-0000000000a1', :'turma', 5, 'Corrigiu o posicionamento, domina o nível.') is not null as corrigiu;
select pg_temp.conferir(count(*) = 1, 'correção no mês não duplica') from beach.avaliacoes_aluno where aluno_id = '00000000-0000-0000-0000-0000000000a1';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select pg_temp.conferir(pg_temp.erro_de(format('insert into beach.matricula_turmas values (%L, %L)', :'mat_a1', :'turma_d')) not like '%subir de nível%', 'com 5 estrelas a trava de nível libera');

-- ===== avaliação anônima da aula =====
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.conferir(count(*) = 1, 'a1 pode avaliar a aula passada') from beach.aulas_para_avaliar() where aula_id = :'passada';
select pg_temp.esperar_erro(format('select beach.avaliar_aula(%L, 6)', :'passada'), 'nota fora de 1 a 5');
select pg_temp.esperar_erro(format('select beach.avaliar_aula(%L, 5)', :'fut'), 'avaliar aula futura');
select beach.avaliar_aula(:'passada', 5, 'Aula ótima');
select pg_temp.esperar_erro(format('select beach.avaliar_aula(%L, 4)', :'passada'), 'avaliar 2x');
select pg_temp.conferir(count(*) = 0, 'aula avaliada sai da lista') from beach.aulas_para_avaliar() where aula_id = :'passada';
select pg_temp.esperar_erro('select count(*) from beach.avaliacoes_aula', 'aluno não lê as notas');
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select pg_temp.esperar_erro(format('select beach.avaliar_aula(%L, 1)', :'passada'), 'aluno de outra turma avalia');
select set_config('request.jwt.claims', json_build_object('sub', :'prof', 'role', 'authenticated')::text, false) is not null as prof_on;
select pg_temp.esperar_erro('select count(*) from beach.avaliacoes_aula', 'professor não lê a tabela de notas (anonimato)');
select pg_temp.conferir(count(*) = 0, 'nota do mês corrente ainda não liberada') from beach.avaliacoes_liberadas();
select pg_temp.conferir(count(*) = 0, 'resumo só com meses liberados') from beach.resumo_avaliacoes();
select pg_temp.conferir(count(*) = 0, 'professor não vê quem avaliou') from beach.avaliacoes_aula_feitas;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select pg_temp.conferir(count(*) = 0, 'recepção também só vê meses liberados') from beach.resumo_avaliacoes();
