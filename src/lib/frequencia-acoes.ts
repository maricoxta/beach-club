"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isData } from "@/lib/agenda/datas";
import { BUCKET_FOTOS, isTipoAtividade, mesDe } from "@/lib/frequencia";
import { getSessao } from "@/lib/sessao";
import { numero, texto } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export type EstadoCheckin = { erro?: string } | undefined;

async function exigirAluno() {
  const { perfil } = await getSessao();
  if (!perfil || !perfil.ativo || perfil.papel !== "aluno") throw new Error("Acesso restrito a alunos.");
  return perfil;
}

function inteiroOuNull(form: FormData, campo: string) {
  const n = numero(form, campo);
  return n === null ? null : Math.round(n);
}

// Cria um check-in. A foto já foi enviada pelo navegador direto ao Storage
// (evita o limite de tamanho das Server Actions); aqui chega só o caminho.
export async function criarCheckin(_: EstadoCheckin, form: FormData): Promise<EstadoCheckin> {
  const perfil = await exigirAluno();

  const data = texto(form, "data");
  const tipo = texto(form, "tipo");
  const fotoPath = texto(form, "foto_path") || null;
  if (!isData(data)) return { erro: "Informe a data da atividade." };
  if (!isTipoAtividade(tipo)) return { erro: "Escolha qual foi a atividade." };
  if (fotoPath && !fotoPath.startsWith(`${perfil.id}/`)) return { erro: "Foto inválida. Envie de novo." };

  const horas = inteiroOuNull(form, "horas") ?? 0;
  const minutos = inteiroOuNull(form, "minutos") ?? 0;
  const duracao = horas * 60 + minutos;
  if (horas < 0 || minutos < 0 || duracao > 24 * 60) return { erro: "Tempo de exercício inválido." };

  const distancia = numero(form, "distancia_km");
  const calorias = inteiroOuNull(form, "calorias");
  const passos = inteiroOuNull(form, "passos");
  if ([distancia, calorias, passos].some((v) => v !== null && v < 0)) {
    return { erro: "Distância, calorias e passos não podem ser negativos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("atividades").insert({
    aluno_id: perfil.id,
    data,
    tipo,
    duracao_min: duracao || null,
    distancia_km: distancia,
    calorias,
    passos,
    foto_path: fotoPath,
    observacao: texto(form, "observacao").slice(0, 500) || null,
  });

  if (error) {
    if (fotoPath) await supabase.storage.from(BUCKET_FOTOS).remove([fotoPath]);
    if (error.message.includes("atividades_data_nao_futura")) return { erro: "Não dá para registrar atividade no futuro." };
    if (error.code === "23514") return { erro: "Confira os valores: algum número está fora do esperado." };
    console.error("[frequencia] criar:", error.code, error.message);
    return { erro: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/aluno/frequencia");
  redirect(`/aluno/frequencia?mes=${mesDe(data)}&dia=${data}&ok=1`);
}

export async function excluirCheckin(form: FormData) {
  const perfil = await exigirAluno();
  const id = texto(form, "id");
  const supabase = await createClient();
  const { data } = await supabase
    .from("atividades")
    .delete()
    .eq("id", id)
    .eq("aluno_id", perfil.id)
    .select("data, foto_path")
    .maybeSingle();
  if (data?.foto_path) await supabase.storage.from(BUCKET_FOTOS).remove([data.foto_path]);
  revalidatePath("/aluno/frequencia");
  const volta = data?.data ?? texto(form, "dia");
  redirect(isData(volta) ? `/aluno/frequencia?mes=${mesDe(volta)}&dia=${volta}` : "/aluno/frequencia");
}
