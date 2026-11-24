-- =============================================================================
-- Beach club: dados de referência iniciais
-- Planos, quadras e preços ficam para a administração cadastrar pelo app.
-- =============================================================================

insert into beach.modalidades (nome, descricao) values
  ('Beach Tênis', 'Aulas de beach tennis'),
  ('Vôlei de Praia', 'Aulas de vôlei de praia')
on conflict (nome) do nothing;

insert into beach.niveis (nome, ordem) values
  ('Iniciante', 1),
  ('Intermediário', 2),
  ('Avançado', 3)
on conflict (nome) do nothing;
