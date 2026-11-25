-- Recepção é avisada da desmarcação e decide. Rodar depois de 07.
\set QUIET 1
create or replace function pg_temp.esperar_erro(sql text, rotulo text) returns text language plpgsql as $f$
begin execute sql; return 'FALHOU (deveria dar erro): '||rotulo;
exception when others then return 'ok erro esperado: '||rotulo||' -> '||sqlerrm; end $f$;
create or replace function pg_temp.conferir(ok boolean, rotulo text) returns text language sql as $f$
  select case when ok then 'ok: ' else 'FALHOU: ' end || rotulo $f$;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select a.id as d1 from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome like 'BT Iniciante%' and a.data > current_date + 2 order by a.data offset 1 limit 1 \gset
select a.id as d2 from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome like 'BT Iniciante%' and a.data > current_date + 2 order by a.data offset 2 limit 1 \gset
select pg_temp.conferir(beach.contar_desmarcacoes_pendentes() = 0, 'sem desmarcação pendente');

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select beach.desmarcar_aula(:'d1');
select beach.desmarcar_aula(:'d2');
select pg_temp.conferir(beach.contar_desmarcacoes_pendentes() = 0, 'aluno não vê contador');
select pg_temp.esperar_erro($$select * from beach.desmarcacoes_pendentes()$$, 'aluno lista pendentes');

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select pg_temp.conferir(beach.contar_desmarcacoes_pendentes() = 2, 'recepção vê 2 desmarcações');
select presenca_id as p1 from beach.desmarcacoes_pendentes() where aula_id = :'d1' \gset
select presenca_id as p2 from beach.desmarcacoes_pendentes() where aula_id = :'d2' \gset
select beach.liberar_desmarcacao(:'p1');
select pg_temp.conferir(vagas = 1 and liberar_em <= now(), 'liberar cria 1 vaga liberada agora') from beach.liberacoes_vagas where aula_id = :'d1';
select beach.manter_desmarcacao(:'p2');
select pg_temp.conferir(count(*) = 0, 'mantida: sem liberação') from beach.liberacoes_vagas where aula_id = :'d2';
select pg_temp.conferir(beach.contar_desmarcacoes_pendentes() = 0, 'decididas somem do aviso');

-- aluno remarca e desmarca de novo: volta a avisar
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select beach.remarcar_aula(:'d2');
select beach.desmarcar_aula(:'d2');
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select pg_temp.conferir(beach.contar_desmarcacoes_pendentes() = 1, 'nova desmarcação volta a avisar');
-- liberação pelo formulário depois da desmarcação também conta como decisão
select beach.liberar_vagas(:'d2', 1, null);
select pg_temp.conferir(beach.contar_desmarcacoes_pendentes() = 0, 'liberar pelo formulário decide');
select pg_temp.esperar_erro(format('select beach.liberar_desmarcacao(%L)', :'p2'), 'presença antiga (remarcada) não existe mais');
-- limpa
select beach.liberar_vagas(:'d1', 0);
select beach.liberar_vagas(:'d2', 0);
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select beach.remarcar_aula(:'d1');
select beach.remarcar_aula(:'d2');
