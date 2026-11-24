"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mensagemErro } from "@/lib/agenda/erros";
import { isData } from "@/lib/agenda/datas";
import { STATUS_AULA, type StatusAula } from "@/lib/agenda/tipos";
import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";
import { isPapel } from "@/lib/papel";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

// Toda ação confere o papel no servidor (o RLS também barra, mas a mensagem fica clara).
async function exigirStaff() {
  const { perfil } = await getSessao();
  if (!perfil || !perfil.ativo || (perfil.papel !== "admin" && perfil.papel !== "recepcao")) {
    throw new Error("Apenas administração/recepção.");
  }
  return perfil;
}

function texto(form: FormData, campo: string) {
  return String(form.get(campo) ?? "").trim();
}

// ---------------------------------------------------------------- turmas
export async function salvarTurma(id: string | null, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const dados = {
    nome: texto(form, "nome"),
    modalidade_id: texto(form, "modalidade_id"),
    nivel_id: texto(form, "nivel_id"),
    professor_id: texto(form, "professor_id"),
    quadra_id: texto(form, "quadra_id"),
    dia_semana: Number(form.get("dia_semana")),
    hora_inicio: texto(form, "hora_inicio"),
    hora_fim: texto(form, "hora_fim"),
    vagas: Number(form.get("vagas")),
  };
  if (Object.values(dados).some((v) => v === "" || Number.isNaN(v))) return { erro: "Preencha todos os campos." };
  if (dados.dia_semana < 1 || dados.dia_semana > 7) return { erro: "Dia da semana inválido." };
  if (dados.hora_fim <= dados.hora_inicio) return { erro: "O horário de término precisa ser depois do início." };
  if (!Number.isInteger(dados.vagas) || dados.vagas < 1) return { erro: "Informe ao menos 1 vaga." };

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("turmas").update(dados).eq("id", id).select("id").single()
    : await supabase.from("turmas").insert(dados).select("id").single();
  if (error) return { erro: mensagemErro(error) };

  revalidatePath("/admin/turmas");
  if (id) return { ok: "Turma atualizada. As aulas já geradas mantêm professor e quadra; ajuste na agenda se precisar." };
  redirect(`/admin/turmas/${data.id}?criada=1`);
}

export async function alternarTurma(id: string, ativo: boolean): Promise<EstadoAcao> {
  await exigirStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("turmas").update({ ativo }).eq("id", id);
  if (error) return { erro: mensagemErro(error) };
  revalidatePath("/admin/turmas");
  revalidatePath(`/admin/turmas/${id}`);
  return { ok: ativo ? "Turma reativada." : "Turma desativada. Ela não gera novas aulas." };
}

// ---------------------------------------------------------------- aulas
export async function gerarAulas(form: FormData) {
  await exigirStaff();
  const de = texto(form, "de");
  const semanas = Math.min(12, Math.max(1, Number(form.get("semanas")) || 1));
  if (!isData(de)) throw new Error("Data inválida.");
  const ate = new Date(`${de}T00:00:00Z`);
  ate.setUTCDate(ate.getUTCDate() + semanas * 7 - 1);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gerar_aulas", { p_inicio: de, p_fim: ate.toISOString().slice(0, 10) });
  if (error) throw new Error(mensagemErro(error, "Não foi possível gerar as aulas."));
  revalidatePath("/admin/agenda");
  redirect(`/admin/agenda?semana=${de}&geradas=${data ?? 0}`);
}

export async function atualizarAula(id: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const status = texto(form, "status");
  if (!(STATUS_AULA as readonly string[]).includes(status)) return { erro: "Status inválido." };
  const dados = {
    status: status as StatusAula,
    professor_id: texto(form, "professor_id") || null,
    quadra_id: texto(form, "quadra_id") || null,
    observacao: texto(form, "observacao") || null,
  };
  const supabase = await createClient();
  const { error } = await supabase.from("aulas").update(dados).eq("id", id);
  if (error) return { erro: mensagemErro(error) };
  revalidatePath(`/admin/agenda/aulas/${id}`);
  revalidatePath("/admin/agenda");
  return { ok: "Aula atualizada." };
}

export async function adicionarAvulso(aulaId: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const perfil = await exigirStaff();
  const alunoId = texto(form, "aluno_id");
  if (!alunoId) return { erro: "Escolha um aluno." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("presencas")
    .insert({ aula_id: aulaId, aluno_id: alunoId, status: "presente", registrado_por: perfil.id, observacao: "Reposição/avulso" });
  if (error) return { erro: mensagemErro(error) };
  revalidatePath(`/admin/agenda/aulas/${aulaId}`);
  return { ok: "Aluno adicionado à chamada." };
}

// ---------------------------------------------------------------- quadras
export async function salvarQuadra(id: string | null, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const nome = texto(form, "nome");
  const valor = Number(texto(form, "valor_hora").replace(",", ".") || 0);
  if (!nome) return { erro: "Informe o nome da quadra." };
  if (Number.isNaN(valor) || valor < 0) return { erro: "Valor por hora inválido." };
  const dados = { nome, descricao: texto(form, "descricao") || null, valor_hora: valor, ativo: !form.has("ativo") || form.getAll("ativo").includes("1") };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("quadras").update(dados).eq("id", id)
    : await supabase.from("quadras").insert(dados);
  if (error) return { erro: mensagemErro(error) };
  revalidatePath("/admin/quadras");
  return { ok: id ? "Quadra atualizada." : "Quadra cadastrada." };
}

// ---------------------------------------------------------------- equipe
export async function alterarPapel(perfilId: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const eu = await exigirStaff();
  const papel = texto(form, "papel");
  const ativo = form.get("ativo") === "1";
  if (!isPapel(papel)) return { erro: "Papel inválido." };
  if (perfilId === eu.id && (papel !== eu.papel || !ativo)) return { erro: "Você não pode alterar o seu próprio acesso." };

  const supabase = await createClient();
  const { error } = await supabase.from("perfis").update({ papel, ativo }).eq("id", perfilId);
  if (error) return { erro: mensagemErro(error, "Não foi possível alterar o acesso.") };
  revalidatePath("/admin/equipe");
  return { ok: "Acesso atualizado." };
}
