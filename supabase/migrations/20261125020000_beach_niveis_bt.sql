-- =============================================================================
-- Beach club: níveis do clube
-- Aprendiz, Iniciante, Nível D, Nível C, Nível B, Nível A (B e A ainda sem turma: inativos,
-- não aparecem nos formulários). Os antigos Intermediário/Avançado viram D/C.
-- =============================================================================
update beach.niveis set nome = 'Nível D' where nome = 'Intermediário'
  and not exists (select 1 from beach.niveis where nome = 'Nível D');
update beach.niveis set nome = 'Nível C' where nome = 'Avançado'
  and not exists (select 1 from beach.niveis where nome = 'Nível C');

insert into beach.niveis (nome, ordem, ativo) values
  ('Aprendiz', 1, true),
  ('Iniciante', 2, true),
  ('Nível D', 3, true),
  ('Nível C', 4, true),
  ('Nível B', 5, false),
  ('Nível A', 6, false)
on conflict (nome) do update set ordem = excluded.ordem, ativo = excluded.ativo;
