"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

// Desmarcar/remarcar passam por RPC: o banco confere matrícula, prazo de 2h e vaga.
export async function alternarDesmarcacao(aulaId: string, desmarcar: boolean): Promise<EstadoAcao> {
  const { perfil } = await getSessao();
  if (!perfil || perfil.papel !== "aluno") return { erro: "Apenas alunos podem desmarcar aulas." };
  const supabase = await createClient();
  const { error } = await supabase.rpc(desmarcar ? "desmarcar_aula" : "remarcar_aula", { p_aula: aulaId });
  if (error) {
    console.error("[agenda] desmarcar:", error.code, error.message);
    return { erro: error.code === "P0001" || error.code === "23514" || error.code === "42501" ? error.message : "Não foi possível salvar. Tente de novo." };
  }
  revalidatePath("/aluno/agenda");
  revalidatePath("/aluno");
  return { ok: desmarcar ? "Aula desmarcada. Sua vaga ficou livre para outro aluno." : "Pronto, você está de volta nesta aula." };
}
