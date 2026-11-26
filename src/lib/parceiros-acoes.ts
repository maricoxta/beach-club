"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isData } from "@/lib/agenda/datas";
import { BUCKET_LOGOS } from "@/lib/parceiros";
import { getSessao } from "@/lib/sessao";
import { mensagemErro, texto, textoOuNull } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export type EstadoParceiro = { erro?: string; ok?: string } | undefined;

// Só a administração cadastra parceiros (o RLS também barra a recepção).
async function exigirAdmin() {
  const { perfil } = await getSessao();
  if (!perfil || !perfil.ativo || perfil.papel !== "admin") throw new Error("Apenas a administração.");
  return perfil;
}

function revalidar() {
  revalidatePath("/admin/parceiros");
  revalidatePath("/aluno/parceiros");
}

// O logo já foi enviado pelo navegador direto ao Storage; aqui chega só o caminho.
export async function salvarParceiro(id: string | null, _: EstadoParceiro, form: FormData): Promise<EstadoParceiro> {
  await exigirAdmin();

  let link = textoOuNull(form, "link");
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
  const validade = textoOuNull(form, "validade");
  const logo = textoOuNull(form, "logo_path");
  const dados = {
    nome: texto(form, "nome"),
    categoria: textoOuNull(form, "categoria"),
    descricao: textoOuNull(form, "descricao"),
    beneficio: textoOuNull(form, "beneficio"),
    codigo: textoOuNull(form, "codigo"),
    como_usar: textoOuNull(form, "como_usar"),
    validade,
    link,
    contato: textoOuNull(form, "contato"),
    endereco: textoOuNull(form, "endereco"),
    logo_path: logo,
    ativo: form.get("ativo") === "1",
    ordem: Math.max(0, Math.min(999, Number(form.get("ordem")) || 0)),
  };
  if (!dados.nome) return { erro: "Informe o nome do parceiro." };
  if (validade && !isData(validade)) return { erro: "Data de validade inválida." };
  if (dados.ativo && !dados.beneficio) return { erro: "Para publicar, descreva o benefício do voucher." };
  if (logo && (logo.includes("..") || logo.includes("/"))) return { erro: "Logo inválido. Envie de novo." };
  if (link && /\s/.test(link)) return { erro: "O link não pode ter espaços." };

  const supabase = await createClient();
  let logoAntigo: string | null = null;
  if (id) {
    const { data } = await supabase.from("parceiros").select("logo_path").eq("id", id).maybeSingle();
    logoAntigo = data?.logo_path ?? null;
  }
  const { error } = id
    ? await supabase.from("parceiros").update(dados).eq("id", id)
    : await supabase.from("parceiros").insert(dados);
  if (error) {
    if (error.code === "23514") return { erro: "Confira os campos: algum texto está longo demais ou o link não começa com http." };
    return { erro: mensagemErro(error, "um parceiro") };
  }
  if (logoAntigo && logoAntigo !== logo) await supabase.storage.from(BUCKET_LOGOS).remove([logoAntigo]);

  revalidar();
  if (!id) redirect("/admin/parceiros?criado=1");
  return { ok: dados.ativo ? "Salvo e publicado para os alunos." : "Salvo como rascunho (alunos ainda não veem)." };
}

export async function excluirParceiro(id: string): Promise<void> {
  await exigirAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("parceiros").delete().eq("id", id).select("logo_path").maybeSingle();
  if (error) throw new Error(mensagemErro(error));
  if (data?.logo_path) await supabase.storage.from(BUCKET_LOGOS).remove([data.logo_path]);
  revalidar();
  redirect("/admin/parceiros");
}
