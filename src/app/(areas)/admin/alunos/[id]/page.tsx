import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/form-acao";
import {
  Alerta,
  Campo,
  Painel,
  Selo,
  Vazio,
  classeBotaoPerigo,
  classeBotaoSecundario,
  classeCampo,
} from "@/components/ui";
import { DIAS_SEMANA_CURTO, data, hojeISO, hora, moeda, vezesPorSemana } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import {
  adicionarTurma,
  criarMatricula,
  mudarStatusMatricula,
  reenviarAcesso,
  removerTurma,
  salvarAluno,
  salvarMatricula,
} from "../actions";

export const instant = false;

export const metadata: Metadata = { title: "Aluno" };

type Plano = { id: string; nome: string; aulas_por_semana: number; valor_mensal: number; modalidade_id: string | null };
type Matricula = {
  id: string;
  status: "ativa" | "pausada" | "cancelada";
  data_inicio: string;
  data_fim: string | null;
  dia_vencimento: number;
  valor_mensal: number;
  observacao: string | null;
  planos: Plano;
  matricula_turmas: { turma_id: string }[];
};
type Turma = {
  id: string;
  nome: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  vagas: number;
  ativo: boolean;
  modalidade_id: string;
  modalidades: { nome: string } | null;
  niveis: { nome: string; ordem: number } | null;
  quadras: { nome: string } | null;
  professor: { nome: string } | null;
};

const SELO_STATUS = {
  ativa: <Selo cor="verde">Ativa</Selo>,
  pausada: <Selo cor="sol">Pausada</Selo>,
  cancelada: <Selo cor="cinza">Cancelada</Selo>,
};

export default async function AlunoPage({ params, searchParams }: PageProps<"/admin/alunos/[id]">) {
  const { id } = await params;
  const { novo } = await searchParams;
  const supabase = await createClient();

  const [{ data: aluno }, { data: matriculasRaw }, { data: planosRaw }, { data: turmasRaw }, { data: ocupacaoRaw }] =
    await Promise.all([
      supabase
        .from("perfis")
        .select("id, nome, email, telefone, data_nascimento, ativo, papel, created_at")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("matriculas")
        .select(
          "id, status, data_inicio, data_fim, dia_vencimento, valor_mensal, observacao, planos(id, nome, aulas_por_semana, valor_mensal, modalidade_id), matricula_turmas(turma_id)",
        )
        .eq("aluno_id", id)
        .order("status")
        .order("data_inicio", { ascending: false }),
      supabase
        .from("planos")
        .select("id, nome, aulas_por_semana, valor_mensal, modalidade_id")
        .eq("ativo", true)
        .order("aulas_por_semana")
        .order("nome"),
      supabase
        .from("turmas")
        .select(
          "id, nome, dia_semana, hora_inicio, hora_fim, vagas, ativo, modalidade_id, modalidades(nome), niveis(nome, ordem), quadras(nome), professor:perfis!professor_id(nome)",
        )
        .order("dia_semana")
        .order("hora_inicio"),
      supabase.from("matricula_turmas").select("turma_id, matriculas!inner(status)").eq("matriculas.status", "ativa"),
    ]);

  if (!aluno || aluno.papel !== "aluno") notFound();

  const matriculas = (matriculasRaw ?? []) as unknown as Matricula[];
  const planos = (planosRaw ?? []) as Plano[];
  const turmas = (turmasRaw ?? []) as unknown as Turma[];
  const turmaPorId = new Map(turmas.map((t) => [t.id, t]));
  const ocupadas = new Map<string, number>();
  for (const o of ocupacaoRaw ?? []) ocupadas.set(o.turma_id, (ocupadas.get(o.turma_id) ?? 0) + 1);

  const abertas = matriculas.filter((m) => m.status !== "cancelada");
  const encerradas = matriculas.filter((m) => m.status === "cancelada");

  return (
    <>
      <Link href="/admin/alunos" className="text-sm font-semibold text-verde-700 hover:underline">
        ← Voltar para alunos
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold text-verde-900">{aluno.nome}</h1>
        {!aluno.ativo && <Selo cor="cinza">Inativo</Selo>}
      </div>
      {novo && (
        <div className="mb-6">
          <Alerta tipo="ok">
            Aluno cadastrado! Enviamos para {aluno.email} um link para ele entrar e criar a senha. Agora é só fazer a
            matrícula.
          </Alerta>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          {abertas.length === 0 && <Vazio>Este aluno ainda não tem matrícula ativa.</Vazio>}

          {abertas.map((m) => (
            <CartaoMatricula key={m.id} matricula={m} turmas={turmas} turmaPorId={turmaPorId} ocupadas={ocupadas} />
          ))}

          <Painel titulo="Nova matrícula">
            {planos.length === 0 ? (
              <p className="text-sm text-tinta-suave">
                Nenhum plano ativo.{" "}
                <Link href="/admin/alunos/planos" className="font-bold text-verde-700 hover:underline">
                  Cadastre um plano
                </Link>{" "}
                primeiro.
              </p>
            ) : (
              <FormAcao acao={criarMatricula} rotulo="Matricular" limparAoSalvar>
                <input type="hidden" name="aluno_id" value={aluno.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo rotulo="Plano" className="sm:col-span-2">
                    <select name="plano_id" required defaultValue="" className={classeCampo}>
                      <option value="" disabled>
                        Escolha o plano
                      </option>
                      {planos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} · {vezesPorSemana(p.aulas_por_semana)} · {moeda(p.valor_mensal)}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo rotulo="Início">
                    <input name="data_inicio" type="date" defaultValue={hojeISO()} className={classeCampo} />
                  </Campo>
                  <Campo rotulo="Dia de vencimento">
                    <input name="dia_vencimento" type="number" min={1} max={28} defaultValue={10} className={classeCampo} />
                  </Campo>
                  <Campo rotulo="Valor mensal (R$)" dica="Em branco: usa o valor do plano. Preencha para dar desconto.">
                    <input name="valor_mensal" inputMode="decimal" placeholder="Valor do plano" className={classeCampo} />
                  </Campo>
                  <Campo rotulo="Observação">
                    <input name="observacao" className={classeCampo} />
                  </Campo>
                </div>
              </FormAcao>
            )}
          </Painel>

          {encerradas.length > 0 && (
            <Painel titulo="Histórico">
              <ul className="divide-y divide-areia-100 text-sm">
                {encerradas.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-semibold text-verde-900">{m.planos.nome}</span>
                    <span className="text-tinta-suave">
                      {data(m.data_inicio)} a {data(m.data_fim)} · {moeda(m.valor_mensal)}
                    </span>
                  </li>
                ))}
              </ul>
            </Painel>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Painel titulo="Dados do aluno">
            <FormAcao acao={salvarAluno} rotulo="Salvar dados">
              <input type="hidden" name="id" value={aluno.id} />
              <Campo rotulo="Nome">
                <input name="nome" required defaultValue={aluno.nome} className={classeCampo} />
              </Campo>
              <Campo rotulo="E-mail" dica="O e-mail é o login do aluno e não pode ser alterado aqui.">
                <input value={aluno.email ?? ""} disabled className={classeCampo} />
              </Campo>
              <Campo rotulo="Telefone / WhatsApp">
                <input name="telefone" type="tel" defaultValue={aluno.telefone ?? ""} className={classeCampo} />
              </Campo>
              <Campo rotulo="Data de nascimento">
                <input name="data_nascimento" type="date" defaultValue={aluno.data_nascimento ?? ""} className={classeCampo} />
              </Campo>
              <label className="flex items-center gap-2 text-sm font-semibold text-verde-900">
                <input type="checkbox" name="ativo" defaultChecked={aluno.ativo} className="h-4 w-4 accent-verde-700" />
                Cadastro ativo (desmarque para bloquear o acesso)
              </label>
            </FormAcao>
          </Painel>

          <Painel titulo="Acesso">
            <p className="mb-4 text-sm text-tinta-suave">
              Manda para o e-mail do aluno um link para entrar e criar uma nova senha. Use quando ele esquecer a senha
              ou não tiver recebido o primeiro e-mail.
            </p>
            <FormAcao
              acao={reenviarAcesso}
              rotulo="Enviar link de acesso"
              rotuloPendente="Enviando…"
              classeBotaoEnviar={classeBotaoSecundario}
            >
              <input type="hidden" name="email" value={aluno.email ?? ""} />
            </FormAcao>
          </Painel>
        </div>
      </div>
    </>
  );
}

function descreverTurma(t: Turma) {
  return `${DIAS_SEMANA_CURTO[t.dia_semana]} ${hora(t.hora_inicio)}–${hora(t.hora_fim)} · ${t.nome}`;
}

function CartaoMatricula({
  matricula: m,
  turmas,
  turmaPorId,
  ocupadas,
}: {
  matricula: Matricula;
  turmas: Turma[];
  turmaPorId: Map<string, Turma>;
  ocupadas: Map<string, number>;
}) {
  const limite = m.planos.aulas_por_semana;
  const escolhidas = m.matricula_turmas.map((mt) => mt.turma_id);
  const faltam = limite - escolhidas.length;
  const disponiveis = turmas
    .filter((t) => t.ativo && !escolhidas.includes(t.id))
    .filter((t) => !m.planos.modalidade_id || t.modalidade_id === m.planos.modalidade_id);

  return (
    <Painel>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold text-verde-900">{m.planos.nome}</h2>
            {SELO_STATUS[m.status]}
          </div>
          <p className="text-sm text-tinta-suave">
            {vezesPorSemana(limite)} · {moeda(m.valor_mensal)}/mês · vence dia {m.dia_vencimento} · desde{" "}
            {data(m.data_inicio)}
          </p>
          {m.observacao && <p className="mt-1 text-sm italic text-tinta-suave">{m.observacao}</p>}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {m.status === "ativa" ? (
            <FormAcao
              acao={mudarStatusMatricula}
              rotulo="Pausar"
              rotuloPendente="…"
              classeBotaoEnviar={classeBotaoSecundario}
              className="flex flex-col items-end gap-2"
            >
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="status" value="pausada" />
            </FormAcao>
          ) : (
            <FormAcao
              acao={mudarStatusMatricula}
              rotulo="Reativar"
              rotuloPendente="…"
              classeBotaoEnviar={classeBotaoSecundario}
              className="flex flex-col items-end gap-2"
            >
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="status" value="ativa" />
            </FormAcao>
          )}
          <details className="group relative">
            <summary className={`${classeBotaoPerigo} cursor-pointer list-none`}>Cancelar</summary>
            <div className="absolute right-0 z-10 mt-2 w-64 rounded-2xl border border-areia-200 bg-white p-4 shadow-lg">
              <p className="mb-3 text-sm text-tinta">
                Cancelar encerra a matrícula hoje e libera as vagas nas turmas. Não dá para desfazer.
              </p>
              <FormAcao
                acao={mudarStatusMatricula}
                rotulo="Confirmar cancelamento"
                rotuloPendente="Cancelando…"
                classeBotaoEnviar={classeBotaoPerigo}
                className="flex flex-col gap-2"
              >
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="status" value="cancelada" />
              </FormAcao>
            </div>
          </details>
        </div>
      </div>

      <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-tinta-suave">
        Turmas ({escolhidas.length} de {limite})
      </h3>
      {m.status === "pausada" && (
        <p className="mb-3 text-sm text-tinta-suave">Matrícula pausada: o aluno não ocupa vaga nessas turmas.</p>
      )}
      {escolhidas.length === 0 ? (
        <p className="mb-4 text-sm text-tinta-suave">Nenhuma turma escolhida ainda.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {escolhidas.map((turmaId) => {
            const t = turmaPorId.get(turmaId);
            return (
              <li
                key={turmaId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-areia-200 bg-areia-50 px-4 py-3"
              >
                {t ? (
                  <div>
                    <p className="font-bold text-verde-900">
                      {DIAS_SEMANA_CURTO[t.dia_semana]} {hora(t.hora_inicio)}–{hora(t.hora_fim)} · {t.nome}
                      {!t.ativo && (
                        <span className="ml-2">
                          <Selo cor="erro">Turma inativa</Selo>
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-tinta-suave">
                      {[t.modalidades?.nome, t.niveis?.nome, t.quadras?.nome, t.professor && `Prof. ${t.professor.nome}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-tinta-suave">Turma indisponível</p>
                )}
                <FormAcao
                  acao={removerTurma}
                  rotulo="Remover"
                  rotuloPendente="…"
                  classeBotaoEnviar="text-sm font-semibold text-erro hover:underline disabled:opacity-60"
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="matricula_id" value={m.id} />
                  <input type="hidden" name="turma_id" value={turmaId} />
                </FormAcao>
              </li>
            );
          })}
        </ul>
      )}

      {m.status === "ativa" && faltam > 0 && (
        <FormAcao
          acao={adicionarTurma}
          rotulo="Adicionar turma"
          rotuloPendente="Adicionando…"
          classeBotaoEnviar={classeBotaoSecundario}
          className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-sol-400/60 p-4"
        >
          <input type="hidden" name="matricula_id" value={m.id} />
          <Campo rotulo={`Escolha mais ${faltam} turma(s)`}>
            {disponiveis.length === 0 ? (
              <span className="text-sm font-normal text-tinta-suave">
                Nenhuma turma ativa{m.planos.modalidade_id ? " desta modalidade" : ""} disponível. As turmas são criadas
                em Agenda e turmas.
              </span>
            ) : (
              <select name="turma_id" required defaultValue="" className={classeCampo}>
                <option value="" disabled>
                  Selecione…
                </option>
                {disponiveis.map((t) => {
                  const ocupacao = ocupadas.get(t.id) ?? 0;
                  const lotada = ocupacao >= t.vagas;
                  return (
                    <option key={t.id} value={t.id} disabled={lotada}>
                      {descreverTurma(t)} · {[t.niveis?.nome, t.professor?.nome].filter(Boolean).join(" · ")} ·{" "}
                      {lotada ? "lotada" : `${t.vagas - ocupacao} vaga(s)`}
                    </option>
                  );
                })}
              </select>
            )}
          </Campo>
        </FormAcao>
      )}

      {m.status !== "cancelada" && (
        <details className="mt-4 border-t border-areia-100 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-verde-700">Editar valor e vencimento</summary>
          <FormAcao acao={salvarMatricula} rotulo="Salvar matrícula" className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="id" value={m.id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo rotulo="Valor mensal (R$)">
                <input
                  name="valor_mensal"
                  required
                  inputMode="decimal"
                  defaultValue={String(m.valor_mensal).replace(".", ",")}
                  className={classeCampo}
                />
              </Campo>
              <Campo rotulo="Dia de vencimento">
                <input
                  name="dia_vencimento"
                  type="number"
                  min={1}
                  max={28}
                  required
                  defaultValue={m.dia_vencimento}
                  className={classeCampo}
                />
              </Campo>
              <Campo rotulo="Observação">
                <input name="observacao" defaultValue={m.observacao ?? ""} className={classeCampo} />
              </Campo>
            </div>
          </FormAcao>
        </details>
      )}
    </Painel>
  );
}
