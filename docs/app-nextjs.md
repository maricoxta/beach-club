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

Nome provisório **Maré Beach Club**, definido em `src/lib/marca.ts` (ou pela env `NEXT_PUBLIC_CLUB_NOME`).
Paleta em `src/app/globals.css`: areia, mar, coral e sol. Tipografia: Bricolage Grotesque (títulos) e Plus Jakarta Sans (texto).
