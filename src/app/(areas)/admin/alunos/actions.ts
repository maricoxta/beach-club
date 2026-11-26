"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAcao } from "@/components/form-acao";
import { enviarLinkDeAcesso } from "@/lib/convite";
import { hojeISO } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { exigirStaff, mensagemErro, numero, texto, textoOuNull } from "@/lib/staff";

// ---------------------------------------------------------------------------
// Aluno
// ---------------------------------------------------------------------------

export async function cadastrarAluno(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const nome = texto(form, "nome");
  const email = texto(form, "email").toLowerCase();
  const telefone = textoOuNull(form, "telefone");
  const nascimento = textoOuNull(form, "data_nascimento");
  if (!nome || !email) return { erro: "Informe nome e e-mail." };

  const supabase = await createClient();
  const { data: existente } = await supabase.from("perfis").select("id, papel").eq("email", email).maybeSingle();
  if (existente) {
    return {
      erro:
        existente.papel === "aluno"
          ? "Já existe um aluno com esse e-mail. Use a busca para abrir o cadastro."
          : "Esse e-mail já pertence a alguém da equipe.",
    };
  }

  const falha = await enviarLinkDeAcesso(email, { criarConta: true, nome, telefone });
  if (falha) return { erro: falha };

  // O trigger do banco cria o perfil na hora em que a conta é criada.
  const { data: perfil } = await supabase.from("perfis").select("id").eq("email", email).maybeSingle();
  if (!perfil) {
    return {
      erro:
        "Enviamos o link, mas o perfil não foi criado: esse e-mail já tinha conta em outro app deste projeto Supabase. " +
        "Peça para o aluno criar a conta pelo site com outro e-mail.",
    };
  }
  // Conta criada pelo site nasce inativa (aguarda aprovação); quem a recepção cadastra já entra ativo.
  await supabase
    .from("perfis")
    .update(nascimento ? { ativo: true, data_nascimento: nascimento } : { ativo: true })
    .eq("id", perfil.id);

  redirect(`/admin/alunos/${perfil.id}?novo=1`);
}

export async function salvarAluno(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const id = texto(form, "id");
  const nome = texto(form, "nome");
  if (!nome) return { erro: "Informe o nome." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfis")
    .update({
      nome,
      telefone: textoOuNull(form, "telefone"),
      data_nascimento: textoOuNull(form, "data_nascimento"),
      ativo: form.get("ativo") === "on",
    })
    .eq("id", id)
    .eq("papel", "aluno");
  if (error) return { erro: mensagemErro(error) };
  refresh();
  return { ok: "Dados salvos." };
}

export async function reenviarAcesso(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const email = texto(form, "email");
  if (!email) return { erro: "Este aluno não tem e-mail cadastrado." };
  const falha = await enviarLinkDeAcesso(email, { criarConta: false });
  if (falha) return { erro: falha };
  return { ok: `Link enviado para ${email}. Ele serve também para o aluno criar uma nova senha.` };
}

// ---------------------------------------------------------------------------
// Matrícula
// ---------------------------------------------------------------------------

export async function criarMatricula(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const alunoId = texto(form, "aluno_id");
  const planoId = texto(form, "plano_id");
  const vencimento = Number(texto(form, "dia_vencimento") || 10);
  const valor = numero(form, "valor_mensal");
  if (!planoId) return { erro: "Escolha o plano." };
  if (!Number.isInteger(vencimento) || vencimento < 1 || vencimento > 28) {
    return { erro: "O dia de vencimento deve ser de 1 a 28." };
  }
  if (valor !== null && valor < 0) return { erro: "Valor mensal inválido." };

  const supabase = await createClient();
  const { data: ativa } = await supabase
    .from("matriculas")
    .select("id")
    .eq("aluno_id", alunoId)
    .eq("plano_id", planoId)
    .eq("status", "ativa")
    .maybeSingle();
  if (ativa) return { erro: "O aluno já tem uma matrícula ativa nesse plano." };

  const { error } = await supabase.from("matriculas").insert({
    aluno_id: alunoId,
    plano_id: planoId,
    data_inicio: texto(form, "data_inicio") || hojeISO(),
    dia_vencimento: vencimento,
    // null = o trigger do banco usa o valor do plano.
    valor_mensal: valor,
    observacao: textoOuNull(form, "observacao"),
  });
  if (error) return { erro: mensagemErro(error) };
  refresh();
  return { ok: "Matrícula criada. Agora escolha as turmas." };
}

export async function salvarMatricula(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const id = texto(form, "id");
  const vencimento = Number(texto(form, "dia_vencimento"));
  const valor = numero(form, "valor_mensal");
  if (!Number.isInteger(vencimento) || vencimento < 1 || vencimento > 28) {
    return { erro: "O dia de vencimento deve ser de 1 a 28." };
  }
  if (valor === null || valor < 0) return { erro: "Valor mensal inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("matriculas")
    .update({ dia_vencimento: vencimento, valor_mensal: valor, observacao: textoOuNull(form, "observacao") })
    .eq("id", id);
  if (error) return { erro: mensagemErro(error) };
  refresh();
  return { ok: "Matrícula atualizada." };
}

const STATUS = ["ativa", "pausada", "cancelada"] as const;
type Status = (typeof STATUS)[number];

export async function mudarStatusMatricula(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const id = texto(form, "id");
  const status = texto(form, "status") as Status;
  if (!STATUS.includes(status)) return { erro: "Status inválido." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("matriculas")
    .select("status, data_inicio, matricula_turmas(turma_id)")
    .eq("id", id)
    .maybeSingle();
  if (!atual) return { erro: "Matrícula não encontrada." };
  if (atual.status === "cancelada") return { erro: "Matrícula cancelada não pode ser reaberta. Crie uma nova." };

  // Ao reativar, as turmas voltam a ocupar vaga: confere se ainda há lugar.
  if (status === "ativa") {
    const turmas = (atual.matricula_turmas ?? []).map((t: { turma_id: string }) => t.turma_id);
    if (turmas.length > 0) {
      const lotadas = await turmasLotadas(supabase, turmas);
      if (lotadas.length > 0) {
        return { erro: `Sem vaga para reativar em: ${lotadas.join(", ")}. Remova essas turmas antes.` };
      }
    }
  }

  const hoje = hojeISO();
  const { error } = await supabase
    .from("matriculas")
    .update({
      status,
      // Cancelamento encerra a matrícula hoje (nunca antes do início).
      data_fim: status === "cancelada" ? (hoje < atual.data_inicio ? atual.data_inicio : hoje) : null,
    })
    .eq("id", id);
  if (error) return { erro: mensagemErro(error) };
  refresh();
  return { ok: status === "ativa" ? "Matrícula reativada." : status === "pausada" ? "Matrícula pausada." : "Matrícula cancelada." };
}

async function turmasLotadas(supabase: Awaited<ReturnType<typeof createClient>>, turmaIds: string[]) {
  const [{ data: turmas }, { data: ocupacao }] = await Promise.all([
    supabase.from("turmas").select("id, nome, vagas").in("id", turmaIds),
    supabase.from("matricula_turmas").select("turma_id, matriculas!inner(status)").in("turma_id", turmaIds).eq("matriculas.status", "ativa"),
  ]);
  const ocupadas = new Map<string, number>();
  for (const o of ocupacao ?? []) ocupadas.set(o.turma_id, (ocupadas.get(o.turma_id) ?? 0) + 1);
  return (turmas ?? []).filter((t) => (ocupadas.get(t.id) ?? 0) >= t.vagas).map((t) => t.nome);
}

// ---------------------------------------------------------------------------
// Turmas da matrícula (as regras de vaga e limite do plano estão no trigger do banco)
// ---------------------------------------------------------------------------

export async function adicionarTurma(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const matriculaId = texto(form, "matricula_id");
  const turmaId = texto(form, "turma_id");
  if (!turmaId) return { erro: "Escolha uma turma." };

  const supabase = await createClient();
  const { error } = await supabase.from("matricula_turmas").insert({ matricula_id: matriculaId, turma_id: turmaId });
  if (error) return { erro: error.code === "23505" ? "O aluno já está nessa turma." : mensagemErro(error) };
  refresh();
  return { ok: "Turma adicionada." };
}

export async function removerTurma(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("matricula_turmas")
    .delete()
    .eq("matricula_id", texto(form, "matricula_id"))
    .eq("turma_id", texto(form, "turma_id"));
  if (error) return { erro: mensagemErro(error) };
  refresh();
  return { ok: "Turma removida." };
}
