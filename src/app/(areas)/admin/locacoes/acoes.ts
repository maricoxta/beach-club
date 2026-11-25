"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAcao } from "@/components/form-acao";
import { isData } from "@/lib/agenda/datas";
import { FORMAS_PAGAMENTO, HORA_ABRE, HORA_FECHA, instante, MAX_HORAS, type FormaPagamento } from "@/lib/locacoes/regras";
import { exigirStaff, numero, texto, textoOuNull } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

// Mensagens dos erros do banco: exclusão entre locações, trigger de turma, regras de hora cheia/mesmo dia.
function erroLocacao(error: { code?: string; message?: string }) {
  const msg = error.message ?? "";
  if (msg.includes("locacoes_sem_conflito")) return "Já existe uma locação nessa quadra nesse horário.";
  if (error.code === "23P01" || error.code === "P0001") return msg;
  if (error.code === "42501") return "Você não tem permissão para esta ação.";
  if (error.code === "23514") return "Dados inválidos: a locação precisa ser em horas cheias, no mesmo dia.";
  console.error("[locacoes]", error.code, msg);
  return "Não foi possível salvar. Tente novamente.";
}

function isForma(v: string): v is FormaPagamento {
  return (FORMAS_PAGAMENTO as readonly string[]).includes(v);
}

function revalidar(id?: string) {
  revalidatePath("/admin/locacoes");
  revalidatePath("/admin/locacoes/reservas");
  if (id) revalidatePath(`/admin/locacoes/${id}`);
}

export async function criarLocacao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const quadra_id = texto(form, "quadra_id");
  const data = texto(form, "data");
  const hora = Number(form.get("hora"));
  const horas = Number(form.get("horas"));
  const alunoId = textoOuNull(form, "aluno_id");
  let nome = textoOuNull(form, "cliente_nome");
  let telefone = textoOuNull(form, "cliente_telefone");
  const valorHora = numero(form, "valor_hora");
  const pagarAgora = form.get("pagar_agora") === "1";
  const forma = texto(form, "forma");

  if (!quadra_id) return { erro: "Escolha a quadra." };
  if (!isData(data)) return { erro: "Informe a data." };
  if (!Number.isInteger(hora) || hora < HORA_ABRE || hora >= HORA_FECHA) return { erro: "Horário inválido." };
  if (!Number.isInteger(horas) || horas < 1 || horas > MAX_HORAS) return { erro: `Duração de 1 a ${MAX_HORAS} horas.` };
  if (hora + horas > HORA_FECHA) return { erro: `O clube fecha às ${HORA_FECHA}h.` };
  if (valorHora !== null && valorHora < 0) return { erro: "Valor por hora inválido." };
  if (pagarAgora && !isForma(forma)) return { erro: "Escolha a forma de pagamento." };

  const supabase = await createClient();
  if (alunoId) {
    const { data: aluno } = await supabase.from("perfis").select("nome, telefone").eq("id", alunoId).maybeSingle();
    if (!aluno) return { erro: "Aluno não encontrado." };
    nome = nome || aluno.nome;
    telefone = telefone || aluno.telefone;
  }
  if (!nome) return { erro: "Informe o nome do cliente." };

  const { data: criada, error } = await supabase
    .from("locacoes")
    .insert({
      quadra_id,
      cliente_id: alunoId,
      cliente_nome: nome,
      cliente_telefone: telefone,
      inicio: instante(data, hora * 60),
      fim: instante(data, (hora + horas) * 60),
      // Em branco: o trigger copia o valor/hora da quadra.
      ...(valorHora !== null ? { valor_hora: valorHora } : {}),
      observacao: textoOuNull(form, "observacao"),
    })
    .select("id, valor_total")
    .single();
  if (error) return { erro: erroLocacao(error) };

  let aviso = "";
  if (pagarAgora && Number(criada.valor_total) > 0) {
    const { error: errPag } = await supabase
      .from("pagamentos")
      .insert({ locacao_id: criada.id, valor: Number(criada.valor_total), forma });
    if (errPag) {
      console.error("[locacoes] pagamento", errPag.code, errPag.message);
      aviso = "&pagamento=falhou";
    }
  }
  revalidar();
  redirect(`/admin/locacoes/${criada.id}?criada=1${aviso}`);
}

export async function registrarPagamento(id: string, _: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const valor = numero(form, "valor");
  const forma = texto(form, "forma");
  if (valor === null || valor <= 0) return { erro: "Informe um valor maior que zero." };
  if (!isForma(forma)) return { erro: "Escolha a forma de pagamento." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("pagamentos")
    .insert({ locacao_id: id, valor, forma, observacao: textoOuNull(form, "observacao") });
  if (error) return { erro: erroLocacao(error) };
  revalidar(id);
  return { ok: "Pagamento registrado." };
}

export async function mudarStatus(id: string, status: "confirmada" | "cancelada"): Promise<EstadoAcao> {
  await exigirStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("locacoes").update({ status }).eq("id", id);
  if (error) return { erro: erroLocacao(error) };
  revalidar(id);
  return { ok: status === "cancelada" ? "Cancelada. O horário ficou livre." : "Locação confirmada." };
}
