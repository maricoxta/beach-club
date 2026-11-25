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

// Check-in: o aluno confirma que vai à aula (até 2h antes). O banco confere turma e prazo.
export async function alternarCheckin(aulaId: string, fazer: boolean): Promise<EstadoAcao> {
  const { perfil } = await getSessao();
  if (!perfil || perfil.papel !== "aluno") return { erro: "Apenas alunos fazem check-in." };
  const supabase = await createClient();
  const { error } = await supabase.rpc(fazer ? "fazer_checkin" : "desfazer_checkin", { p_aula: aulaId });
  if (error) {
    console.error("[agenda] checkin:", error.code, error.message);
    return { erro: ["P0001", "23514", "42501"].includes(error.code) ? error.message : "Não foi possível salvar. Tente de novo." };
  }
  revalidatePath("/aluno/agenda");
  revalidatePath("/aluno");
  return { ok: fazer ? "Check-in feito! O professor já sabe que você vai." : "Check-in desfeito." };
}

// Avaliação anônima da aula (1 a 5 + comentário opcional).
export async function avaliarAula(aulaId: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const { perfil } = await getSessao();
  if (!perfil || perfil.papel !== "aluno") return { erro: "Apenas alunos avaliam aulas." };
  const nota = Number(form.get("nota"));
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) return { erro: "Escolha de 1 a 5 estrelas." };
  const comentario = String(form.get("comentario") ?? "").trim().slice(0, 1000);
  const supabase = await createClient();
  const { error } = await supabase.rpc("avaliar_aula", { p_aula: aulaId, p_nota: nota, p_comentario: comentario || null });
  if (error) {
    console.error("[agenda] avaliar_aula:", error.code, error.message);
    return { erro: ["P0001", "23514", "42501"].includes(error.code) ? error.message : "Não foi possível salvar. Tente de novo." };
  }
  revalidatePath("/aluno");
  return { ok: "Obrigado! Sua avaliação é anônima." };
}
