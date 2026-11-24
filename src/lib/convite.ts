import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { supabaseEnv } from "@/lib/supabase/env";

// Envia ao aluno um link de acesso por e-mail (magic link) e, se ele ainda não tiver conta, cria a conta.
//
// Usa um client "sem sessão" (não grava cookies), para não trocar o login da recepção pelo do aluno,
// e o fluxo implícito: o link volta para /auth/acesso com os tokens no #hash, que a página lê no navegador.
// O PKCE (padrão do app) não serve aqui porque o code_verifier ficaria no servidor, e não no navegador do aluno.
//
// "app: beach-club" faz o trigger do banco criar o perfil em beach.perfis como aluno.
export async function enviarLinkDeAcesso(
  email: string,
  opcoes: { criarConta: boolean; nome?: string; telefone?: string | null },
) {
  const { url, key } = supabaseEnv();
  const supabase = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "implicit" },
  });

  const h = await headers();
  const origem = process.env.NEXT_PUBLIC_SITE_URL ?? h.get("origin") ?? `https://${h.get("host")}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: opcoes.criarConta,
      emailRedirectTo: `${origem}/auth/acesso`,
      data: opcoes.criarConta ? { app: "beach-club", nome: opcoes.nome, telefone: opcoes.telefone } : undefined,
    },
  });
  if (!error) return null;

  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    return "Limite de e-mails do Supabase atingido. Aguarde alguns minutos e tente de novo.";
  }
  console.error("[convite]", error.code, error.message);
  return `Não foi possível enviar o e-mail (${error.message}).`;
}
