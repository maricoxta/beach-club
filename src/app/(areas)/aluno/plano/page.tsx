import type { Metadata } from "next";
import { Painel, Selo, Vazio } from "@/components/ui";
import { DIAS_SEMANA, data, hora, moeda, vezesPorSemana } from "@/lib/formato";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Plano e pagamentos" };

type Turma = {
  id: string;
  nome: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  modalidades: { nome: string } | null;
  niveis: { nome: string } | null;
  quadras: { nome: string } | null;
  professor: { nome: string } | null;
};
type Mensalidade = {
  id: string;
  competencia: string;
  vencimento: string;
  valor_liquido: number;
  valor_pago: number;
  saldo: number;
  status: "aberta" | "paga" | "cancelada";
  vencida: boolean;
};
type Pagamento = { id: string; mensalidade_id: string; valor: number; pago_em: string; forma: string };

const FORMAS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
};

function competencia(valor: string) {
  const t = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(`${valor.slice(0, 10)}T00:00:00Z`),
  );
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type Matricula = {
  id: string;
  status: "ativa" | "pausada" | "cancelada";
  data_inicio: string;
  data_fim: string | null;
  dia_vencimento: number;
  valor_mensal: number;
  planos: { nome: string; aulas_por_semana: number } | null;
  matricula_turmas: { turmas: Turma | null }[];
};

export default async function MeuPlanoPage() {
  const { perfil } = await getSessao();
  const supabase = await createClient();
  // O RLS já limita às matrículas do próprio aluno; o filtro por aluno_id deixa isso explícito.
  const { data: rows } = await supabase
    .from("matriculas")
    .select(
      "id, status, data_inicio, data_fim, dia_vencimento, valor_mensal, planos(nome, aulas_por_semana), matricula_turmas(turmas(id, nome, dia_semana, hora_inicio, hora_fim, modalidades(nome), niveis(nome), quadras(nome), professor:perfis!professor_id(nome)))",
    )
    .eq("aluno_id", perfil?.id ?? "")
    .order("data_inicio", { ascending: false });

  // Mensalidades (view com valor pago/saldo) e pagamentos; o RLS limita ao próprio aluno.
  const [{ data: mensRows }, { data: pagRows }] = await Promise.all([
    supabase
      .from("vw_mensalidades")
      .select("id, competencia, vencimento, valor_liquido, valor_pago, saldo, status, vencida")
      .eq("aluno_id", perfil?.id ?? "")
      .neq("status", "cancelada")
      .order("competencia", { ascending: false })
      .limit(12),
    supabase
      .from("pagamentos")
      .select("id, mensalidade_id, valor, pago_em, forma")
      .not("mensalidade_id", "is", null)
      .order("pago_em", { ascending: false })
      .limit(50),
  ]);
  const mensalidades = (mensRows ?? []) as Mensalidade[];
  const pagamentosPor = new Map<string, Pagamento[]>();
  for (const p of (pagRows ?? []) as Pagamento[]) {
    pagamentosPor.set(p.mensalidade_id, [...(pagamentosPor.get(p.mensalidade_id) ?? []), p]);
  }
  const emAberto = mensalidades.filter((m) => m.status === "aberta");
  const totalAberto = emAberto.reduce((s, m) => s + Number(m.saldo), 0);
  const vencidas = emAberto.filter((m) => m.vencida).length;

  const matriculas = (rows ?? []) as unknown as Matricula[];
  const abertas = matriculas.filter((m) => m.status !== "cancelada");
  const encerradas = matriculas.filter((m) => m.status === "cancelada");

  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-verde-900 sm:text-4xl">Plano e pagamentos</h1>
        <p className="mt-1 text-tinta-suave">Sua matrícula, os horários fixos das suas turmas e suas mensalidades.</p>
      </div>

      {abertas.length === 0 && (
        <Vazio>Você ainda não tem um plano ativo. Fale com a recepção para escolher seu plano e suas turmas.</Vazio>
      )}

      <div className="flex flex-col gap-6">
        {abertas.map((m) => {
          const turmas = m.matricula_turmas
            .map((mt) => mt.turmas)
            .filter((t): t is Turma => Boolean(t))
            .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));
          const limite = m.planos?.aulas_por_semana ?? 0;
          return (
            <Painel key={m.id}>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-2xl font-bold text-verde-900">{m.planos?.nome}</h2>
                    {m.status === "ativa" ? <Selo cor="verde">Ativa</Selo> : <Selo cor="sol">Pausada</Selo>}
                  </div>
                  <p className="text-sm text-tinta-suave">
                    {vezesPorSemana(limite)} · desde {data(m.data_inicio)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-bold text-verde-700">{moeda(m.valor_mensal)}</p>
                  <p className="text-xs text-tinta-suave">por mês · vence todo dia {m.dia_vencimento}</p>
                </div>
              </div>

              {turmas.length === 0 ? (
                <p className="text-sm text-tinta-suave">A recepção ainda vai definir os horários das suas turmas.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {turmas.map((t) => (
                    <li key={t.id} className="flex gap-4 rounded-2xl border border-areia-200 bg-areia-50 p-4">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-verde-700 text-center font-display text-sm font-bold leading-tight text-white">
                        {DIAS_SEMANA[t.dia_semana].slice(0, 3)}
                        <br />
                        {hora(t.hora_inicio)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-verde-900">{t.nome}</p>
                        <p className="text-sm text-tinta-suave">
                          {DIAS_SEMANA[t.dia_semana]}, {hora(t.hora_inicio)} às {hora(t.hora_fim)}
                        </p>
                        <p className="text-xs text-tinta-suave">
                          {[t.modalidades?.nome, t.niveis?.nome, t.quadras?.nome, t.professor && `Prof. ${t.professor.nome}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {m.status === "ativa" && turmas.length < limite && turmas.length > 0 && (
                <p className="mt-3 text-sm font-semibold text-sol-500">
                  Seu plano dá direito a {limite} aulas por semana. Fale com a recepção para escolher o horário que
                  falta.
                </p>
              )}
            </Painel>
          );
        })}

        <Painel
          titulo="Mensalidades"
          acao={
            emAberto.length > 0 ? (
              <span className={`text-sm font-bold ${vencidas ? "text-erro" : "text-verde-800"}`}>
                Em aberto: {moeda(totalAberto)}
                {vencidas > 0 && ` · ${vencidas} vencida${vencidas === 1 ? "" : "s"}`}
              </span>
            ) : mensalidades.length > 0 ? (
              <Selo cor="verde">Tudo em dia</Selo>
            ) : null
          }
        >
          {mensalidades.length === 0 ? (
            <p className="text-sm text-tinta-suave">Nenhuma mensalidade lançada ainda.</p>
          ) : (
            <ul className="divide-y divide-areia-100">
              {mensalidades.map((m) => {
                const pagos = pagamentosPor.get(m.id) ?? [];
                return (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-bold text-verde-900">{competencia(m.competencia)}</p>
                      <p className="text-xs text-tinta-suave">
                        Vence em {data(m.vencimento)}
                        {pagos.length > 0 &&
                          ` · pago ${pagos
                            .map((p) => `${moeda(p.valor)} em ${data(p.pago_em)} (${FORMAS[p.forma] ?? p.forma})`)
                            .join(", ")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-lg font-bold text-verde-900">{moeda(m.valor_liquido)}</span>
                      {m.status === "paga" ? (
                        <Selo cor="verde">Paga</Selo>
                      ) : m.vencida ? (
                        <Selo cor="erro">Vencida</Selo>
                      ) : Number(m.valor_pago) > 0 ? (
                        <Selo cor="sol">Falta {moeda(m.saldo)}</Selo>
                      ) : (
                        <Selo cor="sol">Em aberto</Selo>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-tinta-suave">Para pagar ou tirar dúvidas, fale com a recepção.</p>
        </Painel>

        {encerradas.length > 0 && (
          <Painel titulo="Planos anteriores">
            <ul className="divide-y divide-areia-100 text-sm">
              {encerradas.map((m) => (
                <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-semibold text-verde-900">{m.planos?.nome}</span>
                  <span className="text-tinta-suave">
                    {data(m.data_inicio)} a {data(m.data_fim)}
                  </span>
                </li>
              ))}
            </ul>
          </Painel>
        )}
      </div>
    </>
  );
}
