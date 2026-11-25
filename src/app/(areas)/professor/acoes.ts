"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

// Avaliação mensal do aluno (1 a 5 estrelas + comentário) no nível da turma.
export async function avaliarAluno(alunoId: string, turmaId: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const { perfil } = await getSessao();
  if (!perfil || !["professor", "admin", "recepcao"].includes(perfil.papel)) return { erro: "Sem permissão." };
  const nota = Number(form.get("nota"));
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) return { erro: "Escolha de 1 a 5 estrelas." };
  const comentario = String(form.get("comentario") ?? "").trim().slice(0, 2000);
  if (comentario.length < 20) return { erro: "Escreva um comentário fundamentado (pelo menos 20 caracteres)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("avaliar_aluno", { p_aluno: alunoId, p_turma: turmaId, p_nota: nota, p_comentario: comentario });
  if (error) {
    console.error("[agenda] avaliar_aluno:", error.code, error.message);
    return { erro: ["P0001", "23514", "42501"].includes(error.code) ? error.message : "Não foi possível salvar. Tente de novo." };
  }
  revalidatePath("/professor", "layout");
  revalidatePath("/admin/avaliacoes");
  return { ok: nota === 5 ? "Avaliação salva. Com 5 estrelas o aluno já pode subir de nível." : "Avaliação salva." };
}
