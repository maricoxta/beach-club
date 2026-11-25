import type { Metadata } from "next";
import Link from "next/link";
import { FormAcao } from "@/components/form-acao";
import { Indicador, NavegarMes } from "@/components/financeiro/ui";
import { Selo, Vazio, classeBotaoSecundario, classeCampo } from "@/components/ui";
import {
  competenciaDoMes,
  mesDoParametro,
  rotuloMes,
  situacao,
  somarMeses,
  type MensalidadeView,
} from "@/lib/financeiro";
import { data, moeda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { gerarMensalidades } from "./acoes";

export const instant = false;

export const metadata: Metadata = { title: "Financeiro" };

const FILTROS = {
  todas: "Todas",
  abertas: "Em aberto",
  vencidas: "Vencidas",
  pagas: "Pagas",
  canceladas: "Canceladas",
} as const;
type Filtro = keyof typeof FILTROS;

type MatriculaPlano = {
  id: string;
  aluno_id: string;
  data_inicio: string;
  data_fim: string | null;
  planos: { nome: string } | null;
};

export default async function FinanceiroPage({ searchParams }: PageProps<"/admin/financeiro">) {
  const params = await searchParams;
  const mes = mesDoParametro(params.mes);
  const filtro: Filtro = typeof params.filtro === "string" && params.filtro in FILTROS ? (params.filtro as Filtro) : "todas";
  const busca = typeof params.q === "string" ? params.q.trim() : "";
  const competencia = competenciaDoMes(mes);
  const fimDoMes = `${somarMeses(mes, 1)}-01`;

  const supabase = await createClient();
  const [{ data: linhas, error }, { data: ativas }] = await Promise.all([
    supabase
      .from("vw_mensalidades")
      .select("*")
      .eq("competencia", competencia)
      .order("aluno_nome"),
    // Matrículas ativas que valem neste mês: mostram quantas ainda não têm mensalidade gerada.
    supabase
      .from("matriculas")
      .select("id, aluno_id, data_inicio, data_fim, planos(nome)")
      .eq("status", "ativa")
      .lt("data_inicio", fimDoMes)
      .or(`data_fim.is.null,data_fim.gte.${competencia}`),
  ]);
  if (error) console.error("[financeiro]", error.code, error.message);

  const todas = (linhas ?? []) as MensalidadeView[];
  const matriculasAtivas = (ativas ?? []) as unknown as MatriculaPlano[];

  // Nome do plano por matrícula (inclui matrículas pausadas/canceladas que têm mensalidade no mês).
  const planoPorMatricula = new Map(matriculasAtivas.map((m) => [m.id, m.planos?.nome ?? ""]));
  const semPlano = todas.map((m) => m.matricula_id).filter((id) => !planoPorMatricula.has(id));
  if (semPlano.length > 0) {
    const { data: outras } = await supabase.from("matriculas").select("id, planos(nome)").in("id", semPlano);
    for (const m of (outras ?? []) as unknown as { id: string; planos: { nome: string } | null }[]) {
      planoPorMatricula.set(m.id, m.planos?.nome ?? "");
    }
  }
  const comMensalidade = new Set(todas.map((m) => m.matricula_id));
  const faltando = matriculasAtivas.filter((m) => !comMensalidade.has(m.id)).length;

  const validas = todas.filter((m) => m.status !== "cancelada");
  const previsto = validas.reduce((s, m) => s + Number(m.valor_liquido), 0);
  const recebido = validas.reduce((s, m) => s + Number(m.valor_pago), 0);
  const emAberto = validas.filter((m) => m.status === "aberta").reduce((s, m) => s + Number(m.saldo), 0);
  const vencidas = validas.filter((m) => m.vencida);
  const vencido = vencidas.reduce((s, m) => s + Number(m.saldo), 0);
  const pagas = validas.filter((m) => m.status === "paga").length;

  const termo = busca.toLocaleLowerCase("pt-BR");
  const exibidas = todas.filter((m) => {
    if (termo && !m.aluno_nome.toLocaleLowerCase("pt-BR").includes(termo)) return false;
    switch (filtro) {
      case "abertas":
        return m.status === "aberta";
      case "vencidas":
        return m.vencida;
      case "pagas":
        return m.status === "paga";
      case "canceladas":
        return m.status === "cancelada";
      default:
        return true;
    }
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-verde-900">Mensalidades</h1>
          <p className="mt-1 text-tinta-suave">Cobranças do mês por matrícula ativa e registro de pagamentos.</p>
        </div>
        <NavegarMes mes={mes} base="/admin/financeiro" params={filtro !== "todas" ? { filtro } : {}} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Previsto" valor={moeda(previsto)} detalhe={`${validas.length} mensalidades`} />
        <Indicador
          rotulo="Recebido"
          valor={moeda(recebido)}
          detalhe={`${pagas} pagas${previsto > 0 ? ` · ${Math.round((recebido / previsto) * 100)}%` : ""}`}
          cor="verde"
        />
        <Indicador rotulo="Em aberto" valor={moeda(emAberto)} cor="sol" />
        <Indicador
          rotulo="Vencido"
          valor={moeda(vencido)}
          detalhe={`${vencidas.length} ${vencidas.length === 1 ? "mensalidade" : "mensalidades"}`}
          cor={vencido > 0 ? "erro" : "neutro"}
        />
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-areia-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="font-bold text-verde-900">Gerar mensalidades de {rotuloMes(mes)}</p>
          <p className="text-tinta-suave">
            {faltando > 0
              ? `${faltando} ${faltando === 1 ? "matrícula ativa ainda não tem" : "matrículas ativas ainda não têm"} mensalidade neste mês.`
              : "Todas as matrículas ativas já têm a mensalidade deste mês."}{" "}
            Usa o valor e o dia de vencimento de cada matrícula. Pode clicar de novo sem duplicar.
          </p>
        </div>
        <FormAcao
          acao={gerarMensalidades}
          rotulo={faltando > 0 ? `Gerar ${faltando}` : "Gerar"}
          rotuloPendente="Gerando…"
          className="flex shrink-0 flex-col items-start gap-2 sm:items-end"
        >
          <input type="hidden" name="mes" value={mes} />
        </FormAcao>
      </div>

      <form className="mb-4 flex flex-wrap gap-3" role="search">
        <input type="hidden" name="mes" value={mes} />
        <input name="q" defaultValue={busca} placeholder="Buscar aluno" className={`${classeCampo} max-w-xs flex-1`} />
        <select name="filtro" defaultValue={filtro} className={`${classeCampo} w-auto`}>
          {Object.entries(FILTROS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
        <button className="rounded-full border-2 border-verde-700 px-5 text-sm font-bold text-verde-700 transition hover:bg-verde-700 hover:text-white">
          Filtrar
        </button>
      </form>

      {exibidas.length === 0 ? (
        <Vazio>
          {todas.length === 0
            ? `Nenhuma mensalidade em ${rotuloMes(mes)}. Use "Gerar" acima para criar as cobranças das matrículas ativas.`
            : "Nenhuma mensalidade com esses filtros."}
        </Vazio>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-areia-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-areia-200 bg-areia-50 text-xs uppercase tracking-wider text-tinta-suave">
              <tr>
                <th className="px-5 py-3 font-bold">Aluno</th>
                <th className="px-5 py-3 font-bold">Vencimento</th>
                <th className="px-5 py-3 text-right font-bold">Valor</th>
                <th className="px-5 py-3 text-right font-bold">Pago</th>
                <th className="px-5 py-3 font-bold">Situação</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-areia-100">
              {exibidas.map((m) => {
                const s = situacao(m);
                return (
                  <tr key={m.id} className="transition hover:bg-areia-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/alunos/${m.aluno_id}`} className="font-bold text-verde-900 hover:underline">
                        {m.aluno_nome}
                      </Link>
                      <p className="text-xs text-tinta-suave">{planoPorMatricula.get(m.matricula_id)}</p>
                    </td>
                    <td className="px-5 py-3 text-tinta-suave">{data(m.vencimento)}</td>
                    <td className="px-5 py-3 text-right">
                      {moeda(m.valor_liquido)}
                      {Number(m.desconto) > 0 && (
                        <p className="text-xs text-tinta-suave">desconto {moeda(m.desconto)}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-tinta-suave">{moeda(m.valor_pago)}</td>
                    <td className="px-5 py-3">
                      <Selo cor={s.cor}>{s.rotulo}</Selo>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/admin/financeiro/mensalidades/${m.id}`} className={classeBotaoSecundario}>
                        {m.status === "aberta" ? "Receber" : "Detalhes"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
