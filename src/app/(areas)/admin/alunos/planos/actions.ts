"use server";

import { refresh } from "next/cache";
import type { EstadoAcao } from "@/components/form-acao";
import { createClient } from "@/lib/supabase/server";
import { exigirStaff, mensagemErro, numero, texto, textoOuNull } from "@/lib/staff";

function lerPlano(form: FormData) {
  const nome = texto(form, "nome");
  const aulas = Number(texto(form, "aulas_por_semana"));
  const valor = numero(form, "valor_mensal");
  if (!nome) return { erro: "Informe o nome do plano." } as const;
  if (!Number.isInteger(aulas) || aulas < 1 || aulas > 7) {
    return { erro: "Aulas por semana deve ser de 1 a 7." } as const;
  }
  if (valor === null || valor < 0) return { erro: "Informe um valor mensal válido." } as const;
  return {
    dados: {
      nome,
      aulas_por_semana: aulas,
      valor_mensal: valor,
      modalidade_id: textoOuNull(form, "modalidade_id"),
      ativo: form.get("ativo") === "on",
    },
  } as const;
}

export async function criarPlano(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const lido = lerPlano(form);
  if ("erro" in lido) return { erro: lido.erro };

  const supabase = await createClient();
  const { error } = await supabase.from("planos").insert(lido.dados);
  if (error) return { erro: mensagemErro(error, "um plano") };
  refresh();
  return { ok: `Plano "${lido.dados.nome}" criado.` };
}

export async function salvarPlano(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const id = texto(form, "id");
  const lido = lerPlano(form);
  if ("erro" in lido) return { erro: lido.erro };

  const supabase = await createClient();
  const { error } = await supabase.from("planos").update(lido.dados).eq("id", id);
  if (error) return { erro: mensagemErro(error, "um plano") };
  refresh();
  return { ok: "Plano atualizado." };
}
