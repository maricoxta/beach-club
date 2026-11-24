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
