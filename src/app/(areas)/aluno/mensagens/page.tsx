import type { Metadata } from "next";
import { Cabecalho, Vazio } from "@/components/agenda/ui";
import { Conversa } from "@/components/chat/conversa";
import { LIMITE_HISTORICO, type Mensagem } from "@/lib/chat";
import { exigirArea } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "Mensagens" };

export default async function MensagensAlunoPage() {
  const perfil = await exigirArea("aluno");
  const supabase = await createClient();
  const [{ data: conversa }, { data, error }] = await Promise.all([
    supabase.from("conversas").select("aluno_leu_em").eq("aluno_id", perfil.id).maybeSingle(),
    supabase
      .from("mensagens")
      .select("id, aluno_id, da_equipe, texto, created_at")
      .eq("aluno_id", perfil.id)
      .order("id", { ascending: false })
      .limit(LIMITE_HISTORICO),
  ]);
  if (error) console.error("[chat] mensagens do aluno:", error.code, error.message);
  const mensagens = ((data ?? []) as Mensagem[]).reverse();
  const leuEm = conversa?.aluno_leu_em ? Date.parse(conversa.aluno_leu_em) : 0;
  const temNaoLidas = mensagens.some((m) => m.da_equipe && Date.parse(m.created_at) > leuEm);

  return (
    <>
      <Cabecalho
        titulo="Fale com a recepção"
        subtitulo="Dúvidas sobre aulas, plano ou pagamentos? Mande aqui. A recepção responde nesta conversa."
      />
      {error ? (
        <Vazio>Não foi possível carregar a conversa. Tente de novo em instantes.</Vazio>
      ) : (
        <Conversa
          mensagens={mensagens}
          lado="aluno"
          nomeOutroLado="Recepção"
          temNaoLidas={temNaoLidas}
          vazio="Nenhuma mensagem ainda. Escreva abaixo e a recepção vai te responder por aqui."
        />
      )}
    </>
  );
}
