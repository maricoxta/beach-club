# App web (Next.js)

Next.js 16 (App Router, TypeScript, Tailwind 4) com Supabase Auth. Todas as consultas usam o schema `beach`
do projeto Supabase `lplvhzuaineeqvzszgjd` (o `public` pertence a outros apps).

## Rodando localmente

```bash
cp .env.example .env.local   # preencha a chave publishable/anon do Supabase
npm install
npm run dev                  # http://localhost:3000
```

## Como funciona o acesso

| Papel (`beach.perfis.papel`) | Área |
| --- | --- |
| `admin`, `recepcao` | `/admin` (administração/recepção) |
| `professor` | `/professor` |
| `aluno` | `/aluno` |

- `src/proxy.ts` renova a sessão a cada request e manda para `/login` quem não está logado.
- O layout de cada área (`src/app/(areas)/*/layout.tsx`) lê o perfil em `beach.perfis` e, se o papel não
  bate com a área, redireciona para a área certa. Sem perfil ou com perfil inativo, vai para `/sem-acesso`.
- O cadastro público cria sempre um **aluno**: o `signUp` envia `options.data.app = 'beach-club'`, que o
  trigger do banco usa para criar o perfil (o `auth.users` é compartilhado com outros apps do projeto).
  Professores e equipe são promovidos pela administração.
- A segurança de verdade está no RLS do banco. Os redirecionamentos do app são só navegação.

## Deploy na Vercel

1. Importe o repositório na Vercel (framework detectado: Next.js, sem configuração extra).
2. Variáveis de ambiente (Production e Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://lplvhzuaineeqvzszgjd.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = chave publishable (ou anon legada) do projeto
   - `NEXT_PUBLIC_SITE_URL` = URL de produção (ex.: `https://beach-club.vercel.app`), usada no link de confirmação
3. No Supabase:
   - **Data API > Exposed schemas**: adicionar `beach`. Sem isso o client recebe erro de schema inválido.
   - **Authentication > URL Configuration**: incluir `https://<seu-domínio>/auth/callback` (e
     `http://localhost:3000/auth/callback`) em Redirect URLs. Atenção: o Site URL é compartilhado com os
     outros apps do projeto, então prefira só acrescentar Redirect URLs.

## Marca

Identidade derivada do logo (`public/logo.png`, também usado como favicon em `src/app/icon.png`):
verde do coqueiro `#2E6B3A`, amarelo do sol `#F7B731` e areia `#E0C596`/`#ECDCBD` sobre fundo branco.
Tokens em `src/app/globals.css`. Tipografia: Outfit (títulos) e Plus Jakarta Sans (texto).
Nome: Cristal Beach Club. Para trocar, edite em `src/lib/marca.ts` ou pela env `NEXT_PUBLIC_CLUB_NOME`.

## Módulo alunos, planos e matrículas

| Rota | Quem | O que faz |
| --- | --- | --- |
| `/admin/alunos` | admin, recepção | Lista e busca alunos, com plano e turmas escolhidas (`2 de 3 · falta escolher`). |
| `/admin/alunos/novo` | admin, recepção | Cadastra aluno e envia link de acesso por e-mail. |
| `/admin/alunos/[id]` | admin, recepção | Dados do aluno, matrículas (criar, pausar, reativar, cancelar, valor/vencimento) e turmas da matrícula. |
| `/admin/alunos/planos` | admin, recepção | Planos (1x/2x/3x por semana, valor, modalidade, ativo). |
| `/aluno/plano` | aluno | Plano atual, valor, vencimento e horários fixos das turmas. |

Regras que ficam no banco (os triggers devolvem a mensagem e o app só repassa):
vaga na turma, limite de turmas pelo plano (`aulas_por_semana`), só matrícula ativa recebe turma,
valor da matrícula copiado do plano quando vem em branco. No app: não deixa duas matrículas ativas no
mesmo plano para o mesmo aluno, e confere vaga antes de reativar uma matrícula pausada.

### Cadastro de aluno pela recepção

Sem service role no app, a recepção cria a conta com `signInWithOtp` (magic link) num client sem sessão
(`src/lib/convite.ts`), mandando `data.app = 'beach-club'` para o trigger criar o perfil. O link volta para
`/auth/acesso`, que guarda a sessão e pede uma senha. O mesmo link serve como "esqueci minha senha"
(botão **Enviar link de acesso** na ficha do aluno).

Configuração necessária no Supabase:
- **Authentication > URL Configuration > Redirect URLs**: incluir `https://<seu-domínio>/auth/acesso`
  (ou `https://<seu-domínio>/auth/**`, que cobre também o `/auth/callback`).
- O SMTP padrão do Supabase tem limite baixo de envios por hora e é feito para testes. Para alunos reais,
  configure um SMTP próprio em **Authentication > Emails > SMTP Settings** (ex.: Resend ou Brevo, que têm plano grátis).

## Agenda de aulas e turmas

| Quem | Rotas | O que faz |
| --- | --- | --- |
| Admin/recepção | `/admin/agenda` | Semana de aulas, botão "Gerar aulas" (chama `beach.gerar_aulas`), detalhe da aula em `/admin/agenda/aulas/[id]` com chamada, cancelamento, professor substituto, troca de quadra e reposição/avulso |
| Admin/recepção | `/admin/turmas`, `/admin/turmas/nova`, `/admin/turmas/[id]` | Turmas (horário semanal fixo) com ocupação de vagas, alunos e próximas aulas |
| Admin/recepção | `/admin/quadras`, `/admin/equipe` | Cadastro de quadras e mudança de papel (aluno → professor/recepção/admin) |
| Professor | `/professor`, `/professor/turmas`, `/professor/aulas/[id]` | Aulas de hoje e dos próximos 7 dias, turmas com alunos, chamada |
| Aluno | `/aluno`, `/aluno/agenda` | Próximas aulas, horários fixos e frequência |

- Fluxo: cadastre quadras → promova professores em Equipe → crie turmas → gere as aulas (idempotente) → matricule alunos → chamada.
- O professor não lê `beach.matriculas` pelo RLS, por isso a lista de alunos e a chamada usam as RPCs
  `beach.alunos_da_turma`, `beach.lista_chamada` e `beach.turmas_ocupacao` (migration `20261124220915_beach_agenda_rpcs`).
- Datas no fuso `America/Sao_Paulo` (`src/lib/agenda/datas.ts`). Consultas em `src/lib/agenda/consultas.ts`.

### Vagas para reposição e aula extra (liberadas pela recepção)

- `/admin/vagas`: aulas com vaga livre nos próximos 7/14/30 dias. Para cada uma a recepção escolhe quantas vagas
  liberar (até as livres) e quando os alunos passam a ver (agora ou data/hora, com atalhos 1 semana / 2 dias / 1 dia
  antes). O mesmo formulário aparece no detalhe da aula. RPCs `beach.liberar_vagas` e `beach.painel_vagas`.
- O aluno só vê e reserva vagas liberadas, em turmas da **mesma modalidade e nível** em que está matriculado
  (`beach.vagas_para_reposicao`, `beach.reservar_reposicao`). Quem reservar primeiro leva (trava na turma).
- `/aluno/avisos`: avisos "vaga disponível na turma X com o professor Y" calculados na leitura (`beach.meus_avisos`),
  sem agendador. O menu mostra "Avisos (n)" e o início do aluno mostra um destaque; abrir a página marca como lidos.
- Migration `20261125013000_beach_liberacao_vagas`, teste `supabase/tests/07_liberacao_vagas.sql`.
- Aviso de desmarcação: quando um aluno desmarca, a recepção vê "Agenda e turmas (n)" no menu, destaque no painel e a lista em `/admin/vagas` com "Liberar vaga" (+1 vaga liberada agora, `beach.liberar_desmarcacao`) ou "Não liberar" (`beach.manter_desmarcacao`). Salvar uma liberação pelo formulário depois da desmarcação também conta como decisão. Migration `20261125021000_beach_aviso_desmarcacao`, teste `08_aviso_desmarcacao.sql`.

## Calendário de frequência do aluno

| Rota | Quem | O que faz |
| --- | --- | --- |
| `/aluno/frequencia` | aluno | Totais (check-ins, dias ativos, tempo total), calendário do mês com foto/ícone em cada dia, totais do mês e detalhe do dia (`?mes=AAAA-MM&dia=AAAA-MM-DD`). |
| `/aluno/frequencia/novo` | aluno | Novo check-in: atividade (Aula/Play de Beach Tênis, Vôlei, Futvôlei), foto, data, tempo, distância, calorias, passos e observação. Vários por dia. |
| `/admin/alunos/[id]/frequencia` | admin, recepção | Mesmo calendário, só leitura (botão na ficha do aluno). |

- Tabela `beach.atividades` + view `beach.vw_frequencia_resumo` (migration `20261124234031_beach_frequencia`). RLS: aluno lê/cria/edita/apaga só as próprias; staff lê todas; professor não vê.
- Fotos no bucket privado `beach-atividades` do Storage, caminho `<aluno_id>/<uuid>.jpg`. O navegador reduz a foto (máx. 1280 px, JPEG) e envia direto ao Storage; a Server Action recebe só o caminho. As páginas exibem com URL assinada de 1 h.
- Código: `src/lib/frequencia*.ts`, `src/components/frequencia/`.

## Financeiro

| Rota | Quem | O que faz |
| --- | --- | --- |
| `/admin/financeiro` | admin, recepção | Mensalidades do mês (`?mes=AAAA-MM`): previsto, recebido, em aberto e vencido; botão **Gerar** (chama `beach.gerar_mensalidades`, idempotente) com aviso de quantas matrículas ativas ainda não têm mensalidade; busca e filtro por situação. |
| `/admin/financeiro/mensalidades/[id]` | admin, recepção | Detalhe: pagamentos, **Registrar pagamento** (valor, forma, data; valor menor que o saldo fica parcial), ajuste de vencimento/valor/desconto, cancelar/reabrir, lembrete no WhatsApp. Estorno de pagamento só para admin. |
| `/admin/financeiro/inadimplencia` | admin, recepção | `beach.vw_inadimplencia`: alunos com mensalidade vencida, meses em aberto, dias de atraso e link de cobrança no WhatsApp. |
| `/admin/financeiro/relatorio` | admin, recepção | `beach.vw_relatorio_mensal` + quadros por modalidade, por plano e por forma de pagamento, e histórico de 6 meses. |

- Não precisou de migration: tabelas, trigger de status (pagamentos → mensalidade paga/aberta), RPC e views já estavam em `20261124203240_beach_financeiro`.
- Regimes: previsto, em aberto e os quadros por modalidade/plano usam a **competência**; "recebido no mês" e formas de pagamento usam **caixa** (`pagamentos.pago_em`).
- Datas de pagamento do formulário são gravadas ao meio-dia de Brasília (`pagoEmDaData`) para não mudar de dia por fuso.
- Locação no relatório: o relatório lê `beach.locacoes` (reservas e horas do mês) e soma como receita os `pagamentos` com `locacao_id` (gravados pelo módulo de locação), pelo mês de `pago_em`.
- Código: `src/app/(areas)/admin/financeiro/`, `src/lib/financeiro.ts`, `src/components/financeiro/ui.tsx`.

## Locação avulsa de quadras

| Rota | Quem | O que faz |
| --- | --- | --- |
| `/admin/locacoes` | admin, recepção | Grade de disponibilidade. **Dia**: horários × quadras. **Semana**: horários × dias de uma quadra. Mostra aulas de turma (bloqueiam) e locações (cor pela situação do pagamento). Clique num horário livre para reservar. |
| `/admin/locacoes/nova` | admin, recepção | Reserva: quadra, data, início, duração (1 a 4 h cheias), cliente (aluno do clube ou avulso com nome/telefone), valor/hora (em branco = preço da quadra) e opção "já recebi o pagamento". |
| `/admin/locacoes/[id]` | admin, recepção | Detalhe, link de WhatsApp, pagamentos (parciais ou total), confirmar e cancelar (cancelar libera o horário). |
| `/admin/locacoes/reservas` | admin, recepção | Lista por período/quadra, filtro "só a receber", totais de valor reservado, recebido e a receber. |

- Sem migration nova: usa `beach.locacoes` e `beach.pagamentos` (migration `20261124203240_beach_financeiro`).
  O banco garante hora cheia, mesmo dia, sem sobreposição com outra locação (`locacoes_sem_conflito`) e sem
  conflito com turma ativa (trigger `tg_locacoes_valida`, que libera o horário quando a aula do dia está cancelada).
  O trigger também congela o `valor_hora` da quadra quando ele vem em branco.
- Pagamento de locação = linha em `beach.pagamentos` com `locacao_id`. A situação (pago, pago em parte, a pagar)
  é calculada somando os pagamentos contra `valor_total`; não há coluna de status de pagamento. Para o relatório
  mensal, `beach.vw_relatorio_mensal.recebido_locacoes` já soma esses pagamentos pelo mês de `pago_em`.
- Faixa da grade: 6h às 23h (`HORA_ABRE`/`HORA_FECHA` em `src/lib/locacoes/regras.ts`). Código: `src/lib/locacoes/`.

### Pedido de locação pelo aluno

| Rota | Quem | O que faz |
| --- | --- | --- |
| `/aluno/quadras` | aluno | Minhas locações (status, cancelar) e grade de horários livres dos próximos 14 dias. |
| `/aluno/quadras/pedir` | aluno | Confirma o pedido: duração (até o próximo horário ocupado), valor estimado e recado. |

- Migration `20261125001236_beach_locacao_aluno`: status `solicitada` em `beach.status_locacao` (pedido aguardando a
  recepção; bloqueia o horário como qualquer locação não cancelada) e as RPCs `beach.horarios_ocupados(de, ate)` (sem dados
  de clientes), `beach.solicitar_locacao(quadra, data, hora, horas, obs)` e `beach.cancelar_minha_locacao(id)`.
  O RLS de `beach.locacoes` continua só staff para insert/update; o aluno passa pelas RPCs.
- Regras no banco: 2 h de antecedência, até 30 dias, 1 a 4 h, 6h às 23h, no máximo 2 pedidos pendentes por aluno.
  O aluno cancela o próprio pedido a qualquer momento e uma locação confirmada até 2 h antes, se não houver pagamento.
- Recepção: a grade mostra o pedido tracejado em amarelo e um aviso "N pedidos aguardando"; no detalhe, **Aprovar pedido**
  (vira `confirmada`) ou **Recusar pedido** (vira `cancelada`). Filtro "Pedidos de alunos" em Reservas e pagamentos.
- Teste local: `supabase/tests/06_locacao_aluno.sql`.
