"use server";

import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { LIMITE_TEXTO, type Mensagem } from "@/lib/chat";

type Resultado = { ok: true; mensagem: Mensagem } | { ok: false; erro: string };

// O banco decide a conversa: aluno sempre escreve na dele; a equipe precisa informar o aluno.
export async function enviarMensagem(texto: string, alunoId?: string): Promise<Resultado> {
  const { perfil } = await getSessao();
  if (!perfil || !perfil.ativo) return { ok: false, erro: "Faça login de novo para enviar." };
  const limpo = texto.trim();
  if (!limpo) return { ok: false, erro: "Escreva uma mensagem." };
  if (limpo.length > LIMITE_TEXTO) return { ok: false, erro: `Máximo de ${LIMITE_TEXTO} caracteres.` };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enviar_mensagem", { p_texto: limpo, p_aluno: alunoId ?? null });
  if (error) {
    console.error("[chat] enviar_mensagem:", error.code, error.message);
    return { ok: false, erro: ["22023", "42501", "P0001"].includes(error.code) ? error.message : "Não foi possível enviar. Tente de novo." };
  }
  return { ok: true, mensagem: data as Mensagem };
}

export async function marcarConversaLida(alunoId?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_conversa_lida", { p_aluno: alunoId ?? null });
  if (error) console.error("[chat] marcar_conversa_lida:", error.code, error.message);
}
