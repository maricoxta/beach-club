"use server";

import { refresh } from "next/cache";
import type { EstadoAcao } from "@/components/form-acao";
import { competenciaDoMes, isForma, pagoEmDaData, rotuloMes } from "@/lib/financeiro";
import { hojeISO } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { exigirStaff, mensagemErro, numero, texto, textoOuNull } from "@/lib/staff";

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Geração das mensalidades do mês (RPC idempotente: não duplica as que já existem)
// ---------------------------------------------------------------------------
export async function gerarMensalidades(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const mes = texto(form, "mes");
  if (!/^\d{4}-\d{2}$/.test(mes)) return { erro: "Mês inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gerar_mensalidades", { p_competencia: competenciaDoMes(mes) });
  if (error) return { erro: mensagemErro(error) };
  refresh();
  const qtd = Number(data ?? 0);
  return {
    ok:
      qtd === 0
        ? `Nenhuma mensalidade nova: todas as matrículas ativas já têm a de ${rotuloMes(mes)}.`
        : `${qtd} ${qtd === 1 ? "mensalidade criada" : "mensalidades criadas"} para ${rotuloMes(mes)}.`,
  };
}

// ---------------------------------------------------------------------------
// Pagamentos (o trigger do banco marca a mensalidade como paga quando o total cobre o valor)
// ---------------------------------------------------------------------------
export async function registrarPagamento(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const mensalidadeId = texto(form, "mensalidade_id");
  const valor = numero(form, "valor");
  const forma = texto(form, "forma");
  const dataPagamento = texto(form, "data") || hojeISO();
  if (!valor || valor <= 0) return { erro: "Informe o valor recebido." };
  if (!isForma(forma)) return { erro: "Escolha a forma de pagamento." };
  if (!DATA_ISO.test(dataPagamento)) return { erro: "Data inválida." };
  if (dataPagamento > hojeISO()) return { erro: "A data do pagamento não pode ser no futuro." };

  const supabase = await createClient();
  const { data: m } = await supabase
    .from("vw_mensalidades")
    .select("status, saldo")
    .eq("id", mensalidadeId)
    .maybeSingle();
  if (!m) return { erro: "Mensalidade não encontrada." };
  if (m.status === "cancelada") return { erro: "Mensalidade cancelada não recebe pagamento." };
  if (m.status === "paga") return { erro: "Esta mensalidade já está paga." };
  // Tolerância de 1 centavo para arredondamento.
  if (valor > Number(m.saldo) + 0.005) {
    return { erro: `O valor é maior que o saldo em aberto (${Number(m.saldo).toFixed(2).replace(".", ",")}).` };
  }

  const { error } = await supabase.from("pagamentos").insert({
    mensalidade_id: mensalidadeId,
    valor,
    forma,
    pago_em: pagoEmDaData(dataPagamento),
    observacao: textoOuNull(form, "observacao"),
  });
  if (error) return { erro: mensagemErro(error) };
  refresh();
  return { ok: valor >= Number(m.saldo) - 0.005 ? "Pagamento registrado. Mensalidade quitada." : "Pagamento parcial registrado." };
}

// Estorno: só admin (RLS de pagamentos permite delete apenas para admin).
export async function estornarPagamento(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const perfil = await exigirStaff();
  if (perfil.papel !== "admin") return { erro: "Apenas o admin pode estornar pagamentos." };
  const id = texto(form, "id");
  const supabase = await createClient();
  const { data, error } = await supabase.from("pagamentos").delete().eq("id", id).select("id");
  if (error) return { erro: mensagemErro(error) };
  if (!data?.length) return { erro: "Pagamento não encontrado ou sem permissão." };
  refresh();
  return { ok: "Pagamento estornado." };
}

// ---------------------------------------------------------------------------
// Ajustes na mensalidade
// ---------------------------------------------------------------------------
export async function salvarMensalidade(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const id = texto(form, "id");
  const vencimento = texto(form, "vencimento");
  const valor = numero(form, "valor");
  const desconto = numero(form, "desconto") ?? 0;
  if (!DATA_ISO.test(vencimento)) return { erro: "Informe o vencimento." };
  if (valor === null || valor < 0) return { erro: "Informe o valor." };
  if (desconto < 0 || desconto > valor) return { erro: "O desconto precisa ficar entre zero e o valor." };

  const supabase = await createClient();
  const { data: atual } = await supabase.from("vw_mensalidades").select("status, valor_pago").eq("id", id).maybeSingle();
  if (!atual) return { erro: "Mensalidade não encontrada." };
  if (atual.status === "cancelada") return { erro: "Reabra a mensalidade antes de editar." };

  const liquido = valor - desconto;
  const pago = Number(atual.valor_pago);
  // O status depende de pagamentos x valor líquido: recalcula aqui porque o trigger só roda em pagamentos.
  const status = pago > 0 && pago >= liquido - 0.005 ? "paga" : "aberta";
  const { error } = await supabase
    .from("mensalidades")
    .update({ vencimento, valor, desconto, status, observacao: textoOuNull(form, "observacao") })
    .eq("id", id);
  if (error) return { erro: mensagemErro(error) };
  refresh();
  return { ok: "Mensalidade atualizada." };
}

export async function mudarStatusMensalidade(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const id = texto(form, "id");
  const acao = texto(form, "acao");
  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("vw_mensalidades")
    .select("status, valor_pago, valor_liquido")
    .eq("id", id)
    .maybeSingle();
  if (!atual) return { erro: "Mensalidade não encontrada." };

  let status: "aberta" | "paga" | "cancelada";
  if (acao === "cancelar") {
    if (Number(atual.valor_pago) > 0) return { erro: "Há pagamentos nesta mensalidade. Estorne-os antes de cancelar." };
    status = "cancelada";
  } else if (acao === "reabrir") {
    status = Number(atual.valor_pago) >= Number(atual.valor_liquido) && Number(atual.valor_pago) > 0 ? "paga" : "aberta";
  } else {
    return { erro: "Ação inválida." };
  }

  const { error } = await supabase.from("mensalidades").update({ status }).eq("id", id);
  if (error) return { erro: mensagemErro(error) };
  refresh();
  return { ok: acao === "cancelar" ? "Mensalidade cancelada. Ela sai do previsto e da inadimplência." : "Mensalidade reaberta." };
}
