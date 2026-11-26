-- Dados de teste (rodar como postgres). NÃO aplicar no Supabase.
\set ON_ERROR_STOP 1
-- dados como postgres (sistema)
insert into auth.users (id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','admin@x','{"app":"beach-club","nome":"Ana Admin"}'),
 ('00000000-0000-0000-0000-00000000000e','rec@x','{"app":"beach-club","nome":"Rita Recepção"}'),
 ('00000000-0000-0000-0000-00000000000b','prof@x','{"app":"beach-club","nome":"Paulo Prof"}'),
 ('00000000-0000-0000-0000-00000000000c','prof2@x','{"app":"beach-club","nome":"Pedro Prof"}'),
 ('00000000-0000-0000-0000-0000000000a1','al1@x','{"app":"beach-club","nome":"Alu Um"}'),
 ('00000000-0000-0000-0000-0000000000a2','al2@x','{"app":"beach-club"}'),
 ('00000000-0000-0000-0000-0000000000ff','outro@x','{}');
select count(*) as perfis_criados from beach.perfis;  -- esperado 6 (outro app não cria)
-- cadastro pelo site nasce inativo (aguarda a recepção); aqui ativamos todos
update beach.perfis set ativo = true;
update beach.perfis set papel='admin' where email='admin@x';
update beach.perfis set papel='recepcao' where email='rec@x';
update beach.perfis set papel='professor' where email like 'prof%';
insert into beach.quadras (nome, valor_hora) values ('Quadra 1', 80), ('Quadra 2', 70);
insert into beach.planos (nome, aulas_por_semana, valor_mensal) values ('1x',1,200),('2x',2,350);
