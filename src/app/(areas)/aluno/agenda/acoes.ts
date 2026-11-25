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

export async function reservarAula(aulaId: string): Promise<EstadoAcao> {
  return chamarRpc("reservar_reposicao", aulaId, "Reserva feita! A aula já aparece na sua agenda.");
}

export async function cancelarReserva(aulaId: string): Promise<EstadoAcao> {
  return chamarRpc("cancelar_reposicao", aulaId, "Reserva cancelada. Seu crédito voltou.");
}

async function chamarRpc(fn: string, aulaId: string, ok: string): Promise<EstadoAcao> {
  const { perfil } = await getSessao();
  if (!perfil || perfil.papel !== "aluno") return { erro: "Apenas alunos podem reservar aulas." };
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_aula: aulaId });
  if (error) {
    console.error(`[agenda] ${fn}:`, error.code, error.message);
    return { erro: ["P0001", "23514", "42501"].includes(error.code) ? error.message : "Não foi possível salvar. Tente de novo." };
  }
  revalidatePath("/aluno/agenda");
  revalidatePath("/aluno/reposicao");
  revalidatePath("/aluno/avisos");
  revalidatePath("/aluno", "layout");
  return { ok };
}

// Chamado ao abrir /aluno/avisos: zera o contador do menu.
export async function marcarAvisosLidos(): Promise<void> {
  const { perfil } = await getSessao();
  if (!perfil || perfil.papel !== "aluno") return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_avisos_lidos");
  if (error) console.error("[agenda] marcar_avisos_lidos:", error.code, error.message);
  else revalidatePath("/aluno", "layout");
}
