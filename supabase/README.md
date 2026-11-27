# Banco de dados (Supabase, schema `beach`)

Tudo do beach club vive no schema **`beach`** do projeto Supabase compartilhado.
O schema `public` (que tem tabelas de outros projetos) não é tocado.

## Migrations

| Arquivo | O que faz |
|---|---|
| `20261124203125_beach_schema_base.sql` | schema, enums, `perfis`, `modalidades`, `niveis`, `quadras`, `planos` |
| `20261124203203_beach_turmas_aulas.sql` | helpers de papel, `turmas`, `aulas`, `matriculas`, `matricula_turmas`, `presencas`, `gerar_aulas()` |
| `20261124203240_beach_financeiro.sql` | `mensalidades`, `pagamentos`, `locacoes`, `gerar_mensalidades()`, views de relatório |
| `20261124203321_beach_rls.sql` | trigger de signup, proteção de papel, grants e políticas RLS |
| `20261124203329_beach_dados_iniciais.sql` | modalidades e níveis iniciais |
| `20261127180000_beach_perfis_protegidos.sql` | lista `perfis_protegidos`: perfis que só a própria pessoa altera/apaga (protege a conta da dona contra admins de demo) |
| `20261127190000_beach_demo_reset.sql` | reset do ambiente de demo: `demo_tirar_foto()` grava o schema em `beach_demo`, `demo_restaurar([senha])` volta tudo para a foto (só para dados de teste) |

## Modelo

```
auth.users 1─1 perfis (papel: admin | recepcao | professor | aluno)

modalidades ┐
niveis      ├─< turmas (1 horário semanal fixo, vagas) >─ perfis (professor)
quadras     ┘      │
                   ├─< aulas (cada data da turma) ─< presencas >─ perfis (aluno)
                   │
planos ─< matriculas >─ perfis (aluno)
              │  └─< matricula_turmas >─ turmas
              └─< mensalidades ─< pagamentos
quadras ─< locacoes (por hora) ─< pagamentos
```

Decisões principais:

- **Turma = um horário semanal.** Plano 2x/semana = matrícula em 2 turmas. Um trigger
  barra matrícula acima do limite do plano e em turma sem vaga (com lock na turma).
- **Aula = ocorrência datada da turma.** É onde fica a presença e permite cancelar
  uma data ou trocar professor/quadra. `beach.gerar_aulas(inicio, fim)` cria as aulas.
- **Mensalidade por competência.** `beach.gerar_mensalidades(mes)` cria as do mês para
  matrículas ativas (idempotente). O status vira `paga` sozinho quando a soma dos
  pagamentos cobre o valor líquido. Inadimplência = aberta e vencida (calculada, não gravada).
- **Locação por hora cheia**, sem sobreposição na mesma quadra (exclusion constraint)
  e sem conflito com turma ativa, a não ser que a aula daquela data esteja cancelada.
- Datas de negócio usam `America/Sao_Paulo` (`beach.hoje()`).

Views (respeitam o RLS de quem consulta): `vw_mensalidades`, `vw_inadimplencia`,
`vw_relatorio_mensal` (previsto por competência x recebido por data de pagamento).

## Permissões (RLS)

| | admin | recepção | professor | aluno |
|---|---|---|---|---|
| Cadastros (modalidades, níveis, quadras, planos, turmas) | tudo | ler/escrever | ler | ler |
| Perfis | tudo | todos, menos mexer em admin | o próprio + alunos das suas turmas + professores | o próprio + professores |
| Aulas e presenças | tudo | tudo | das suas turmas (lança presença) | das suas turmas / as próprias |
| Matrículas, mensalidades, pagamentos, locações | tudo | ler/escrever (sem apagar) | nada | os próprios (só leitura) |

`anon` não tem acesso ao schema. Ninguém altera o próprio papel.

## Signup

O `auth.users` é compartilhado com outros apps, então o trigger só cria perfil
(sempre `aluno`) quando o signUp envia `options.data.app = 'beach-club'`
(e opcionalmente `nome` e `telefone`). Professores, recepção e admin são promovidos
pela administração. O primeiro admin é promovido pelo SQL Editor:

```sql
update beach.perfis set papel = 'admin' where email = 'voce@exemplo.com';
```

## Status

Aplicadas no projeto `lplvhzuaineeqvzszgjd` em 24/11/2026. Os nomes dos arquivos usam as mesmas versões registradas em `supabase_migrations.schema_migrations`, então `supabase db push` não tenta reaplicar.

## Depois de aplicar

No dashboard do Supabase: **Project Settings → Data API → Exposed schemas**, adicionar `beach`.
No client: `supabase.schema('beach').from('turmas')...`

## Testes locais

`tests/run_local.sh` sobe as migrations num Postgres puro (com um stub do `auth`) e roda
testes de regras e RLS simulando cada papel.

```bash
PGHOST=/tmp PGPORT=5432 ./supabase/tests/run_local.sh
```
