-- Chat aluno <-> recepção: cada aluno só vê a própria conversa; equipe vê todas.
-- Rodar como authenticator.
\set QUIET 1
create or replace function pg_temp.esperar_erro(sql text, rotulo text) returns text language plpgsql as $f$
begin execute sql; return 'FALHOU (deveria dar erro): '||rotulo;
exception when others then return 'ok erro esperado: '||rotulo||' -> '||sqlerrm; end $f$;
create or replace function pg_temp.conferir(ok boolean, rotulo text) returns text language sql as $f$
  select case when ok then 'ok: ' else 'FALHOU: ' end || rotulo $f$;
set role authenticated;

-- a1 escreve
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.conferir((beach.enviar_mensagem('  Oi, posso trocar de turma?  ')).texto = 'Oi, posso trocar de turma?', 'aluno envia (texto aparado)');
select pg_temp.conferir((beach.enviar_mensagem('Outra dúvida', '00000000-0000-0000-0000-0000000000a2')).aluno_id = '00000000-0000-0000-0000-0000000000a1', 'aluno não escreve na conversa de outro (p_aluno ignorado)');
select pg_temp.esperar_erro($$select beach.enviar_mensagem('   ')$$, 'mensagem vazia');
select pg_temp.esperar_erro(format('select beach.enviar_mensagem(%L)', repeat('x', 2001)), 'mensagem longa');
select pg_temp.esperar_erro($$insert into beach.mensagens (aluno_id, da_equipe, texto) values ('00000000-0000-0000-0000-0000000000a1', true, 'fake')$$, 'insert direto');
select pg_temp.esperar_erro($$select * from beach.caixa_mensagens()$$, 'aluno abre caixa da equipe');
select pg_temp.conferir(beach.contar_mensagens_nao_lidas() = 0, 'aluno sem respostas não lidas');

-- a2 escreve e só vê a dele
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select beach.enviar_mensagem('Bom dia') is not null as a2_enviou;
select pg_temp.conferir(count(*) = 1, 'a2 só vê as próprias mensagens') from beach.mensagens;
select pg_temp.conferir(count(*) = 1, 'a2 só vê a própria conversa') from beach.conversas;

-- professor fora
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select pg_temp.esperar_erro($$select beach.enviar_mensagem('oi')$$, 'professor envia');
select pg_temp.conferir(count(*) = 0, 'professor não lê mensagens') from beach.mensagens;

-- recepção vê tudo e responde
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select pg_temp.conferir(beach.contar_mensagens_nao_lidas() = 3, 'equipe tem 3 não lidas');
select pg_temp.conferir(count(*) = 2 and sum(nao_lidas) = 3, 'caixa com 2 conversas e 3 não lidas') from beach.caixa_mensagens();
select pg_temp.esperar_erro($$select beach.enviar_mensagem('oi')$$, 'equipe sem aluno');
select pg_temp.esperar_erro($$select beach.enviar_mensagem('oi', '00000000-0000-0000-0000-00000000000b')$$, 'equipe escreve para professor');
select pg_temp.conferir((beach.enviar_mensagem('Pode sim!', '00000000-0000-0000-0000-0000000000a1')).da_equipe, 'recepção responde');
select pg_temp.conferir(beach.contar_mensagens_nao_lidas() = 1, 'responder marca a conversa como lida (sobra a do a2)');
select beach.marcar_conversa_lida('00000000-0000-0000-0000-0000000000a2');
-- admin compartilha o estado de leitura da equipe
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select pg_temp.conferir(beach.contar_mensagens_nao_lidas() = 0, 'admin vê tudo lido pela recepção');
select pg_temp.conferir((select ultima_da_equipe from beach.caixa_mensagens() where aluno_id = '00000000-0000-0000-0000-0000000000a1'), 'caixa mostra última mensagem da equipe');

-- a1 recebe a resposta
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.conferir(beach.contar_mensagens_nao_lidas() = 1, 'aluno tem 1 resposta não lida');
select beach.marcar_conversa_lida();
select pg_temp.conferir(beach.contar_mensagens_nao_lidas() = 0, 'aluno leu');
select pg_temp.conferir(count(*) = 3, 'a1 vê 3 mensagens da conversa') from beach.mensagens;
reset role;
