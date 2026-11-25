"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAcao } from "@/components/form-acao";
import { isData } from "@/lib/agenda/datas";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

// As regras (antecedência, limite de pedidos, conflitos) ficam em beach.solicitar_locacao; aqui só repassamos a mensagem.
function erroPedido(error: { code?: string; message?: string }) {
  const msg = error.message ?? "";
  if (error.code === "P0001" || error.code === "23P01") return msg;
  if (msg.includes("locacoes_sem_conflito")) return "Esse horário acabou de ser reservado. Escolha outro.";
  console.error("[aluno/quadras]", error.code, msg);
  return "Não foi possível enviar o pedido. Tente novamente.";
}

async function exigirAluno() {
  const { perfil } = await getSessao();
  if (!perfil || !perfil.ativo || perfil.papel !== "aluno") throw new Error("Apenas alunos.");
  return perfil;
}

export async function pedirLocacao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirAluno();
  const quadra = String(form.get("quadra_id") ?? "");
  const data = String(form.get("data") ?? "");
  const hora = Number(form.get("hora"));
  const horas = Number(form.get("horas"));
  if (!quadra || !isData(data) || !Number.isInteger(hora) || !Number.isInteger(horas)) {
    return { erro: "Escolha quadra, dia e horário." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("solicitar_locacao", {
    p_quadra: quadra,
    p_data: data,
    p_hora: hora,
    p_horas: horas,
    p_observacao: String(form.get("observacao") ?? "").trim() || null,
  });
  if (error) return { erro: erroPedido(error) };
  revalidatePath("/aluno/quadras");
  redirect(`/aluno/quadras?data=${data}&pedido=1`);
}

export async function cancelarMinhaLocacao(id: string): Promise<EstadoAcao> {
  await exigirAluno();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_minha_locacao", { p_id: id });
  if (error) return { erro: erroPedido(error) };
  revalidatePath("/aluno/quadras");
  return { ok: "Cancelado." };
}
