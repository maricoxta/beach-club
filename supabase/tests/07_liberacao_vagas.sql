-- Recepção libera vagas; aluno só vê/reserva o que foi liberado e recebe aviso.
-- Rodar como authenticator depois de 04_desmarcar_aula.sql.
\set QUIET 1
create or replace function pg_temp.esperar_erro(sql text, rotulo text) returns text language plpgsql as $f$
begin execute sql; return 'FALHOU (deveria dar erro): '||rotulo;
exception when others then return 'ok erro esperado: '||rotulo||' -> '||sqlerrm; end $f$;
create or replace function pg_temp.conferir(ok boolean, rotulo text) returns text language sql as $f$
  select case when ok then 'ok: ' else 'FALHOU: ' end || rotulo $f$;
set role authenticated;

-- recepção cria turma BT Iniciante (2 vagas) e uma BT Avançado
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
insert into beach.turmas (nome, modalidade_id, nivel_id, professor_id, quadra_id, dia_semana, hora_inicio, hora_fim, vagas)
select 'BT Inic Qui 9h', modalidade_id, nivel_id, professor_id, (select id from beach.quadras where nome='Quadra 1'), 4, '09:00', '10:00', 2
from beach.turmas where nome like 'BT Iniciante%' limit 1;
insert into beach.turmas (nome, modalidade_id, nivel_id, professor_id, quadra_id, dia_semana, hora_inicio, hora_fim, vagas)
select 'BT Avanç Qui 11h', modalidade_id, (select id from beach.niveis where nome='Avançado'), professor_id, (select id from beach.quadras where nome='Quadra 1'), 4, '11:00', '12:00', 4
from beach.turmas where nome like 'BT Iniciante%' limit 1;
select beach.gerar_aulas(current_date + 1, current_date + 21) >= 0 as gerou;
select a.id as aula_x from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome='BT Inic Qui 9h' and a.data > current_date + 7 order by a.data limit 1 \gset
select a.id as aula_av from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome='BT Avanç Qui 11h' and a.data > current_date + 7 order by a.data limit 1 \gset
select a.id as aula_a1 from beach.aulas a join beach.turmas t on t.id=a.turma_id where t.nome like 'BT Iniciante%' and a.data > current_date + 1 order by a.data offset 1 limit 1 \gset
select pg_temp.conferir(vagas_livres = 2 and liberadas is null and alunos_avisados = 2, 'painel mostra 2 livres, nada liberado, 2 alunos BT Iniciante a avisar')
from beach.painel_vagas(current_date, current_date + 21) where aula_id = :'aula_x';

-- a1 ganha um crédito desmarcando
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select beach.desmarcar_aula(:'aula_a1');
select beach.marcar_avisos_lidos();  -- avisos de testes anteriores
select pg_temp.conferir(count(*) = 0, 'sem liberação o aluno não vê a vaga') from beach.vagas_para_reposicao(current_date, current_date + 21) where aula_id = :'aula_x';
select pg_temp.conferir(beach.contar_avisos_nao_lidos() = 0, 'sem liberação, sem aviso');
select pg_temp.esperar_erro(format('select beach.reservar_reposicao(%L)', :'aula_x'), 'reservar vaga não liberada');
select pg_temp.esperar_erro(format('select beach.liberar_vagas(%L, 1)', :'aula_x'), 'aluno libera vaga');
select pg_temp.esperar_erro($$select * from beach.painel_vagas(current_date, current_date + 7)$$, 'aluno abre painel');

-- recepção: mais que o livre dá erro; agenda para amanhã
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select pg_temp.esperar_erro(format('select beach.liberar_vagas(%L, 3)', :'aula_x'), 'liberar mais que o livre');
select beach.liberar_vagas(:'aula_x', 1, now() + interval '1 day');
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.conferir(count(*) = 0, 'liberação agendada ainda não aparece') from beach.meus_avisos() where aula_id = :'aula_x';
select pg_temp.conferir(count(*) = 0, 'aluno não lê liberacoes_vagas direto') from beach.liberacoes_vagas;

-- recepção libera agora (1 das 2)
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select beach.liberar_vagas(:'aula_x', 1, null);
select pg_temp.conferir(disponiveis_agora = 1 and liberadas = 1, 'painel: 1 liberada disponível') from beach.painel_vagas(current_date, current_date + 21) where aula_id = :'aula_x';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.conferir(situacao = 'disponivel' and vagas_disponiveis = 1 and not lido, 'a1 recebe aviso disponível') from beach.meus_avisos() where aula_id = :'aula_x';
select pg_temp.conferir(beach.contar_avisos_nao_lidos() = 1, 'a1 tem 1 aviso não lido');
select beach.marcar_avisos_lidos();
select pg_temp.conferir(beach.contar_avisos_nao_lidos() = 0, 'aviso lido zera o contador');
select pg_temp.conferir(vagas_livres = 1, 'a1 vê só 1 vaga (a liberada)') from beach.vagas_para_reposicao(current_date, current_date + 21) where aula_id = :'aula_x';
-- a2 (BT Ter 7h, plano 2x) clica primeiro
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select pg_temp.conferir(count(*) = 1, 'a2 também recebe o aviso') from beach.meus_avisos() where aula_id = :'aula_x';
select beach.reservar_reposicao(:'aula_x') is not null as a2_reservou;
select pg_temp.conferir(situacao = 'reservada', 'aviso de a2 vira reservada') from beach.meus_avisos() where aula_id = :'aula_x';
-- a1 chega tarde
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.esperar_erro(format('select beach.reservar_reposicao(%L)', :'aula_x'), 'segundo a clicar');
select pg_temp.conferir(situacao = 'esgotada', 'aviso de a1 vira esgotada') from beach.meus_avisos() where aula_id = :'aula_x';

-- outro nível: a1 não recebe nem reserva
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select beach.liberar_vagas(:'aula_av', 2, null);
select pg_temp.conferir(alunos_avisados = 0, 'ninguém é do BT Avançado') from beach.painel_vagas(current_date, current_date + 21) where aula_id = :'aula_av';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.conferir(count(*) = 0, 'a1 não recebe aviso de outro nível') from beach.meus_avisos() where aula_id = :'aula_av';
select pg_temp.esperar_erro(format('select beach.reservar_reposicao(%L)', :'aula_av'), 'reservar outro nível');

-- recepção: não dá para baixar abaixo do já reservado? (2 = 1 livre + 1 reservada é o máximo)
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select beach.liberar_vagas(:'aula_x', 2, null);
select pg_temp.conferir(disponiveis_agora = 1 and reservadas = 1, 'libera a 2ª vaga: 1 disponível, 1 reservada') from beach.painel_vagas(current_date, current_date + 21) where aula_id = :'aula_x';
select beach.liberar_vagas(:'aula_av', 0);
select pg_temp.conferir(count(*) = 0, 'liberar 0 tira a liberação') from beach.liberacoes_vagas where aula_id = :'aula_av';
-- limpa: a1 remarca, a2 cancela
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select beach.cancelar_reposicao(:'aula_x');
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select beach.remarcar_aula(:'aula_a1');
