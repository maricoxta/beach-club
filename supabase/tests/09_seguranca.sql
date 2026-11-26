-- Revisão de segurança (migration 20261126033000). Rodar depois dos outros 09.
\set QUIET 1
-- dados como postgres: aulas de outubro (mês já liberado) com notas
\connect - postgres
insert into beach.aulas (turma_id, data)
select t.id, d from beach.turmas t, (values ('2026-10-05'::date), ('2026-10-12'::date)) v(d)
where t.nome = 'BT Iniciante Seg 18h' on conflict do nothing;
insert into beach.avaliacoes_aula (aula_id, professor_id, nota, comentario)
select a.id, '00000000-0000-0000-0000-00000000000b', n, c
from beach.aulas a join beach.turmas t on t.id = a.turma_id,
     (values (5, 'Ótima'), (4, null), (3, 'Corrida')) v(n, c)
where t.nome = 'BT Iniciante Seg 18h' and a.data = '2026-10-05';
-- Pedro (prof2) com só 2 notas em outubro: não libera
insert into beach.avaliacoes_aula (aula_id, professor_id, nota)
select a.id, '00000000-0000-0000-0000-00000000000c', 2
from beach.aulas a join beach.turmas t on t.id = a.turma_id, generate_series(1, 2)
where t.nome = 'BT Iniciante Seg 18h' and a.data = '2026-10-12';

-- cadastro novo pelo site nasce inativo
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a9', 'novo@x', '{"app":"beach-club","nome":"Novo Cadastro"}');

\connect - authenticator
create or replace function pg_temp.esperar_erro(sql text, rotulo text) returns text language plpgsql as $f$
begin execute sql; return 'FALHOU (deveria dar erro): '||rotulo;
exception when others then return 'ok erro esperado: '||rotulo||' -> '||sqlerrm; end $f$;
create or replace function pg_temp.conferir(ok boolean, rotulo text) returns text language sql as $f$
  select case when ok then 'ok: ' else 'FALHOU: ' end || rotulo $f$;
set role authenticated;

-- ===== avaliações anônimas =====
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select pg_temp.conferir(count(*) = 3 and min(mes) = '2026-10-01', 'professor vê as 3 notas de outubro, só com o mês') from beach.avaliacoes_liberadas();
select pg_temp.conferir(avaliacoes = 3 and media = 4 and mes_recente = '2026-10-01', 'resumo do professor com mês liberado') from beach.resumo_avaliacoes();
select pg_temp.esperar_erro('select aula_id from beach.avaliacoes_aula', 'professor lê aula_id das notas');
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select pg_temp.conferir(count(*) = 0, 'menos de 3 notas no mês não libera') from beach.avaliacoes_liberadas();
select pg_temp.conferir(count(*) = 0, 'professor não vê notas de outro professor') from beach.avaliacoes_liberadas() where professor_id = '00000000-0000-0000-0000-00000000000b';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select pg_temp.conferir(count(*) = 3, 'recepção vê só as liberadas') from beach.avaliacoes_liberadas();
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.conferir(count(*) = 0, 'aluno não vê notas dos professores') from beach.avaliacoes_liberadas();

-- ===== cadastro pendente =====
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}';
select pg_temp.conferir(ativo = false and papel = 'aluno', 'cadastro pelo site aguarda aprovação') from beach.perfis where id = auth.uid();
select pg_temp.conferir(beach.papel_atual() is null, 'pendente sem papel ativo');
select pg_temp.esperar_erro($$select beach.enviar_mensagem('oi')$$, 'pendente manda mensagem');
select pg_temp.esperar_erro($$select beach.solicitar_locacao((select id from beach.quadras limit 1), current_date + 3, 9, 1, null)$$, 'pendente pede locação');
select pg_temp.esperar_erro($$update beach.perfis set ativo = true where id = auth.uid()$$, 'pendente se ativa sozinho');
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
update beach.perfis set ativo = true where id = '00000000-0000-0000-0000-0000000000a9';
select pg_temp.conferir(ativo, 'recepção aprova o cadastro') from beach.perfis where id = '00000000-0000-0000-0000-0000000000a9';

-- ===== conta de outro app (sem perfil no clube) =====
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}';
select pg_temp.conferir(
  (select count(*) from beach.modalidades) + (select count(*) from beach.niveis) + (select count(*) from beach.quadras)
  + (select count(*) from beach.planos) + (select count(*) from beach.turmas) + (select count(*) from beach.config_pix)
  + (select count(*) from beach.perfis) = 0, 'outro app não lê catálogo, Pix nem professores');
select pg_temp.conferir(count(*) = 0, 'outro app não vê ocupação') from beach.turmas_ocupacao();
select pg_temp.esperar_erro($$select * from beach.horarios_ocupados(current_date, current_date)$$, 'outro app vê horários');
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.conferir(count(*) > 0, 'aluno continua vendo turmas') from beach.turmas;
select pg_temp.conferir(count(*) >= 2, 'aluno continua vendo professores') from beach.perfis where papel = 'professor';
select pg_temp.conferir(count(*) > 0, 'aluno continua vendo níveis') from beach.niveis;

-- ===== papel de recepção só pelo admin =====
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select pg_temp.esperar_erro($$update beach.perfis set papel = 'recepcao' where id = '00000000-0000-0000-0000-0000000000a2'$$, 'recepção promove aluno a recepção');
select pg_temp.esperar_erro($$insert into beach.perfis (id, papel, nome) values ('00000000-0000-0000-0000-0000000000ff', 'recepcao', 'X')$$, 'recepção cria perfil de recepção');
select pg_temp.esperar_erro($$update beach.perfis set ativo = false where id = '00000000-0000-0000-0000-00000000000e'$$, 'recepção desativa recepção');
update beach.perfis set papel = 'professor' where id = '00000000-0000-0000-0000-0000000000a2';
select pg_temp.conferir(papel = 'professor', 'recepção ainda promove a professor') from beach.perfis where id = '00000000-0000-0000-0000-0000000000a2';
update beach.perfis set papel = 'aluno' where id = '00000000-0000-0000-0000-0000000000a2';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
update beach.perfis set papel = 'recepcao' where id = '00000000-0000-0000-0000-0000000000a2';
select pg_temp.conferir(papel = 'recepcao', 'admin promove a recepção') from beach.perfis where id = '00000000-0000-0000-0000-0000000000a2';
update beach.perfis set papel = 'aluno' where id = '00000000-0000-0000-0000-0000000000a2';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.esperar_erro($$update beach.perfis set papel = 'admin' where id = auth.uid()$$, 'aluno se promove a admin');

-- ===== advisor =====
reset role;
select pg_temp.conferir(not has_table_privilege('authenticated', c.oid, 'insert'), 'view de frequência sem escrita')
from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'beach' and c.relname = 'vw_frequencia_resumo';
