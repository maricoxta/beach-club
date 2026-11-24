"use server";

import { revalidatePath } from "next/cache";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { mensagemErro } from "./erros";
import { STATUS_PRESENCA, type StatusPresenca } from "./tipos";

export type EstadoAcao = { erro?: string; ok?: string } | undefined;

function revalidarAula(aulaId: string) {
  revalidatePath(`/professor/aulas/${aulaId}`);
  revalidatePath(`/admin/agenda/aulas/${aulaId}`);
  revalidatePath("/professor");
  revalidatePath("/admin/agenda");
}

// Salva a chamada inteira de uma aula. Campos: status:<aluno_id> = presente | falta | falta_justificada | "" (sem marcação).
// Quem pode: staff ou professor da aula (garantido pelo RLS de beach.presencas).
export async function salvarChamada(aulaId: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const { perfil } = await getSessao();
  if (!perfil || perfil.papel === "aluno") return { erro: "Você não tem permissão para fazer a chamada." };

  const marcar: { aula_id: string; aluno_id: string; status: StatusPresenca; registrado_por: string }[] = [];
  const limpar: string[] = [];
  for (const [campo, valor] of form.entries()) {
    if (!campo.startsWith("status:")) continue;
    const alunoId = campo.slice("status:".length);
    if ((STATUS_PRESENCA as readonly string[]).includes(String(valor))) {
      marcar.push({ aula_id: aulaId, aluno_id: alunoId, status: valor as StatusPresenca, registrado_por: perfil.id });
    } else {
      limpar.push(alunoId);
    }
  }

  const supabase = await createClient();
  if (marcar.length) {
    const { error } = await supabase.from("presencas").upsert(marcar, { onConflict: "aula_id,aluno_id" });
    if (error) return { erro: mensagemErro(error) };
  }
  if (limpar.length) {
    const { error } = await supabase.from("presencas").delete().eq("aula_id", aulaId).in("aluno_id", limpar);
    if (error) return { erro: mensagemErro(error) };
  }
  // Chamada feita = aula realizada (só se ainda estava agendada).
  if (marcar.length && form.get("concluir") === "1") {
    const { error } = await supabase.from("aulas").update({ status: "realizada" }).eq("id", aulaId).eq("status", "agendada");
    if (error) return { erro: mensagemErro(error) };
  }

  revalidarAula(aulaId);
  const presentes = marcar.filter((m) => m.status === "presente").length;
  return { ok: `Chamada salva: ${presentes} presente(s) de ${marcar.length + limpar.length}.` };
}
