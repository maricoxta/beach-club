-- Testes de RLS e regras de negócio. Rodar conectado como "authenticator" (simula o PostgREST). Cada linha "esperar_erro" deve começar com "ok".
\set QUIET 1
create or replace function pg_temp.esperar_erro(sql text, rotulo text) returns text language plpgsql as $f$
begin execute sql; return 'FALHOU (deveria dar erro): '||rotulo;
exception when others then return 'ok erro esperado: '||rotulo||' -> '||sqlerrm; end $f$;

-- ===== RECEPÇÃO =====
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select beach.papel_atual();
insert into beach.turmas (nome, modalidade_id, nivel_id, professor_id, quadra_id, dia_semana, hora_inicio, hora_fim, vagas)
select 'BT Iniciante Seg 18h', (select id from beach.modalidades where nome='Beach Tênis'), (select id from beach.niveis where nome='Iniciante'),
 '00000000-0000-0000-0000-00000000000b', (select id from beach.quadras where nome='Quadra 1'), 1, '18:00','19:00', 1;
insert into beach.turmas (nome, modalidade_id, nivel_id, professor_id, quadra_id, dia_semana, hora_inicio, hora_fim, vagas)
select 'Vôlei Qua 19h', (select id from beach.modalidades where nome='Vôlei de Praia'), (select id from beach.niveis where nome='Iniciante'),
 '00000000-0000-0000-0000-00000000000c', (select id from beach.quadras where nome='Quadra 2'), 3, '19:00','20:00', 10;
select pg_temp.esperar_erro($$insert into beach.turmas (nome, modalidade_id, nivel_id, professor_id, quadra_id, dia_semana, hora_inicio, hora_fim, vagas)
select 'conflito', modalidade_id, nivel_id, '00000000-0000-0000-0000-00000000000c', quadra_id, 1, '18:30','19:30', 5 from beach.turmas limit 1$$, 'turma sobreposta na quadra');
select pg_temp.esperar_erro($$insert into beach.turmas (nome, modalidade_id, nivel_id, professor_id, quadra_id, dia_semana, hora_inicio, hora_fim, vagas)
select 'aluno prof', modalidade_id, nivel_id, '00000000-0000-0000-0000-0000000000a1', (select id from beach.quadras where nome='Quadra 2'), 5, '08:00','09:00', 5 from beach.turmas limit 1$$, 'aluno como professor');
insert into beach.matriculas (aluno_id, plano_id, valor_mensal, data_inicio) values
 ('00000000-0000-0000-0000-0000000000a1', (select id from beach.planos where nome='1x'), null, '2026-11-01'),
 ('00000000-0000-0000-0000-0000000000a2', (select id from beach.planos where nome='2x'), 300, '2026-11-01');
select nome, valor_mensal from beach.matriculas m join beach.perfis p on p.id=m.aluno_id;
insert into beach.matricula_turmas select m.id, t.id from beach.matriculas m, beach.turmas t where m.aluno_id='00000000-0000-0000-0000-0000000000a1' and t.nome like 'BT%';
select pg_temp.esperar_erro($$insert into beach.matricula_turmas select m.id, t.id from beach.matriculas m, beach.turmas t where m.aluno_id='00000000-0000-0000-0000-0000000000a2' and t.nome like 'BT%'$$, 'turma lotada');
select pg_temp.esperar_erro($$insert into beach.matricula_turmas select m.id, t.id from beach.matriculas m, beach.turmas t where m.aluno_id='00000000-0000-0000-0000-0000000000a1' and t.nome like 'Vôlei%'$$, 'limite do plano 1x');
insert into beach.matricula_turmas select m.id, t.id from beach.matriculas m, beach.turmas t where m.aluno_id='00000000-0000-0000-0000-0000000000a2' and t.nome like 'Vôlei%';
select beach.gerar_aulas('2026-11-23','2026-12-06') as aulas_criadas;
select beach.gerar_mensalidades('2026-11-15') as mens_criadas, beach.gerar_mensalidades('2026-11-01') as mens_repetidas;
insert into beach.pagamentos (mensalidade_id, valor, forma) select id, 100, 'pix' from beach.mensalidades where aluno_id='00000000-0000-0000-0000-0000000000a1';
select aluno_nome, valor_liquido, valor_pago, saldo, status, vencida from beach.vw_mensalidades order by 1;
insert into beach.pagamentos (mensalidade_id, valor, forma) select id, 100, 'dinheiro' from beach.mensalidades where aluno_id='00000000-0000-0000-0000-0000000000a1';
select aluno_nome, status from beach.vw_mensalidades order by 1;
-- locações: Seg 23/11/2026 18h-19h quadra 1 conflita com turma; 20h-22h ok
select pg_temp.esperar_erro($$insert into beach.locacoes (quadra_id, cliente_nome, inicio, fim) select id, 'João', '2026-11-23 18:00-03', '2026-11-23 19:00-03' from beach.quadras where nome='Quadra 1'$$, 'locação x turma');
insert into beach.locacoes (quadra_id, cliente_nome, inicio, fim) select id, 'João', '2026-11-23 20:00-03', '2026-11-23 22:00-03' from beach.quadras where nome='Quadra 1';
select pg_temp.esperar_erro($$insert into beach.locacoes (quadra_id, cliente_nome, inicio, fim) select id, 'Maria', '2026-11-23 21:00-03', '2026-11-23 22:00-03' from beach.quadras where nome='Quadra 1'$$, 'locação sobreposta');
select pg_temp.esperar_erro($$insert into beach.locacoes (quadra_id, cliente_nome, inicio, fim) select id, 'Maria', '2026-11-24 21:00-03', '2026-11-24 22:30-03' from beach.quadras where nome='Quadra 1'$$, 'hora quebrada');
select pg_temp.esperar_erro($$insert into beach.locacoes (quadra_id, cliente_nome, inicio, fim) select id, 'Maria', '2026-11-24 23:00-03', '2026-11-25 01:00-03' from beach.quadras where nome='Quadra 1'$$, 'atravessa meia-noite');
-- cancelar a aula de 30/11 libera a quadra
update beach.aulas set status='cancelada' where data='2026-11-30';
insert into beach.locacoes (quadra_id, cliente_id, inicio, fim) select id, '00000000-0000-0000-0000-0000000000a1', '2026-11-30 18:00-03', '2026-11-30 19:00-03' from beach.quadras where nome='Quadra 1';
select cliente_nome, horas, valor_hora, valor_total from beach.locacoes;
insert into beach.pagamentos (locacao_id, valor, forma) select id, 160, 'cartao_debito' from beach.locacoes where cliente_nome='João';
select * from beach.vw_relatorio_mensal;
select pg_temp.esperar_erro($$update beach.perfis set papel='admin' where email='rec@x'$$, 'recepção se promove a admin');
select pg_temp.esperar_erro($$update beach.perfis set papel='aluno' where email='admin@x'$$, 'recepção rebaixa admin');
delete from beach.pagamentos where locacao_id is not null; select count(*) as pagamentos_apos_delete_recepcao from beach.pagamentos;

select a.id as volei_aula from beach.aulas a join beach.turmas t on t.id = a.turma_id where t.nome like 'Vôlei%' limit 1 \gset

-- ===== PROFESSOR Paulo =====
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select 'prof vê perfis' as t, string_agg(nome, ', ' order by nome) from beach.perfis;
select 'prof vê aulas' as t, count(*) from beach.aulas;
select 'prof vê mensalidades' as t, count(*) from beach.mensalidades;
insert into beach.presencas (aula_id, aluno_id) select a.id, '00000000-0000-0000-0000-0000000000a1' from beach.aulas a where a.data='2026-11-23';
select pg_temp.esperar_erro(format($$insert into beach.presencas (aula_id, aluno_id) values (%L, '00000000-0000-0000-0000-0000000000a2')$$, :'volei_aula'), 'prof lança presença em aula de outro professor');
select pg_temp.esperar_erro($$update beach.perfis set papel='admin' where id=auth.uid()$$, 'prof se promove');
select pg_temp.esperar_erro($$select beach.gerar_mensalidades('2026-12-01')$$, 'prof gera mensalidades');
select pg_temp.esperar_erro($$insert into beach.turmas (nome, modalidade_id, nivel_id, professor_id, quadra_id, dia_semana, hora_inicio, hora_fim, vagas) select 'x', modalidade_id, nivel_id, professor_id, quadra_id, 6, '08:00','09:00', 5 from beach.turmas limit 1$$, 'prof cria turma');

-- ===== ALUNO 1 =====
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select 'aluno vê perfis' as t, string_agg(nome, ', ' order by nome) from beach.perfis;
select 'aluno vê aulas' as t, count(*) from beach.aulas;
select 'aluno vê mensalidades/pagamentos/presenças/locações' as t, (select count(*) from beach.mensalidades), (select count(*) from beach.pagamentos), (select count(*) from beach.presencas), (select count(*) from beach.locacoes);
select 'aluno vê relatório' as t, count(*) from beach.vw_inadimplencia;
update beach.perfis set telefone='11999' where id=auth.uid();
select pg_temp.esperar_erro($$update beach.perfis set papel='professor' where id=auth.uid()$$, 'aluno se promove');
update beach.perfis set nome='hack' where email='al2@x'; select 'aluno editou outro?' as t, nome from beach.perfis where email='al2@x';
select pg_temp.esperar_erro($$insert into beach.pagamentos (mensalidade_id, valor, forma) select id, 1, 'pix' from beach.mensalidades$$, 'aluno registra pagamento');

-- ===== ANON =====
reset role; set role anon;
select pg_temp.esperar_erro($$select * from beach.perfis$$, 'anon lê perfis');
