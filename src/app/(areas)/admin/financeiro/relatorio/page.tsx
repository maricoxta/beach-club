import type { Metadata } from "next";
import Link from "next/link";
import { Barra, Indicador, NavegarMes } from "@/components/financeiro/ui";
import { Painel, Vazio } from "@/components/ui";
import {
  FORMAS_PAGAMENTO,
  competenciaDoMes,
  intervaloDoMes,
  mesDoParametro,
  rotuloMes,
  rotuloMesCurto,
  somarMeses,
  type FormaPagamento,
  type MensalidadeView,
} from "@/lib/financeiro";
import { moeda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Relatório mensal" };

// Linha de beach.vw_relatorio_mensal.
type LinhaRelatorio = {
  mes: string;
  previsto_mensalidades: number;
  qtd_mensalidades: number;
  qtd_pagas: number;
  em_aberto: number;
  inadimplente: number;
  recebido_mensalidades: number;
  recebido_locacoes: number;
  total_recebido: number;
};

type Grupo = { nome: string; qtd: number; previsto: number; pago: number; aberto: number };

function agrupar(linhas: MensalidadeView[], chave: (m: MensalidadeView) => string) {
  const grupos = new Map<string, Grupo>();
  for (const m of linhas) {
    const nome = chave(m);
    const g = grupos.get(nome) ?? { nome, qtd: 0, previsto: 0, pago: 0, aberto: 0 };
    g.qtd += 1;
    g.previsto += Number(m.valor_liquido);
    g.pago += Number(m.valor_pago);
    g.aberto += m.status === "aberta" ? Number(m.saldo) : 0;
    grupos.set(nome, g);
  }
  return [...grupos.values()].sort((a, b) => b.previsto - a.previsto);
}

function TabelaGrupos({ grupos, titulo }: { grupos: Grupo[]; titulo: string }) {
  return (
    <Painel titulo={titulo}>
      {grupos.length === 0 ? (
        <Vazio>Sem mensalidades no mês.</Vazio>
      ) : (
        <ul className="flex flex-col gap-4">
          {grupos.map((g) => (
            <li key={g.nome}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-bold text-verde-900">
                  {g.nome} <span className="font-normal text-tinta-suave">· {g.qtd}</span>
                </span>
                <span className="text-tinta-suave">
                  <span className="font-semibold text-verde-700">{moeda(g.pago)}</span> de {moeda(g.previsto)}
                  {g.aberto > 0 && <span className="text-erro"> · {moeda(g.aberto)} em aberto</span>}
                </span>
              </div>
              <Barra parte={g.pago} total={g.previsto} />
            </li>
          ))}
        </ul>
      )}
    </Painel>
  );
}

export default async function RelatorioPage({ searchParams }: PageProps<"/admin/financeiro/relatorio">) {
  const params = await searchParams;
  const mes = mesDoParametro(params.mes);
  const competencia = competenciaDoMes(mes);
  const inicioHistorico = competenciaDoMes(somarMeses(mes, -5));
  const { de, ate } = intervaloDoMes(mes);

  const supabase = await createClient();
  const [{ data: rel }, { data: mens }, { data: pags }, { data: locs }] = await Promise.all([
    supabase
      .from("vw_relatorio_mensal")
      .select("*")
      .gte("mes", inicioHistorico)
      .lte("mes", competencia)
      .order("mes"),
    supabase.from("vw_mensalidades").select("*").eq("competencia", competencia).neq("status", "cancelada"),
    supabase.from("pagamentos").select("valor, forma, mensalidade_id, locacao_id").gte("pago_em", de).lt("pago_em", ate),
    // Gancho para o módulo de locação: reservas do mês (o recebido vem dos pagamentos com locacao_id).
    supabase.from("locacoes").select("valor_total, horas").neq("status", "cancelada").gte("inicio", de).lt("inicio", ate),
  ]);

  const historico = (rel ?? []) as LinhaRelatorio[];
  const atual: LinhaRelatorio =
    historico.find((l) => l.mes === competencia) ??
    { mes: competencia, previsto_mensalidades: 0, qtd_mensalidades: 0, qtd_pagas: 0, em_aberto: 0, inadimplente: 0, recebido_mensalidades: 0, recebido_locacoes: 0, total_recebido: 0 };
  const mensalidades = (mens ?? []) as MensalidadeView[];

  // Plano e modalidade de cada matrícula do mês.
  const matriculaIds = [...new Set(mensalidades.map((m) => m.matricula_id))];
  const { data: mats } = matriculaIds.length
    ? await supabase.from("matriculas").select("id, planos(nome, modalidades(nome))").in("id", matriculaIds)
    : { data: [] };
  const infoMatricula = new Map(
    ((mats ?? []) as unknown as { id: string; planos: { nome: string; modalidades: { nome: string } | null } | null }[]).map(
      (m) => [m.id, { plano: m.planos?.nome ?? "Sem plano", modalidade: m.planos?.modalidades?.nome ?? "Qualquer modalidade" }],
    ),
  );
  const porModalidade = agrupar(mensalidades, (m) => infoMatricula.get(m.matricula_id)?.modalidade ?? "—");
  const porPlano = agrupar(mensalidades, (m) => infoMatricula.get(m.matricula_id)?.plano ?? "—");

  // Recebido por forma de pagamento (caixa do mês).
  const porForma = new Map<FormaPagamento, { mensalidades: number; locacoes: number }>();
  for (const p of (pags ?? []) as { valor: number; forma: FormaPagamento; locacao_id: string | null }[]) {
    const f = porForma.get(p.forma) ?? { mensalidades: 0, locacoes: 0 };
    if (p.locacao_id) f.locacoes += Number(p.valor);
    else f.mensalidades += Number(p.valor);
    porForma.set(p.forma, f);
  }
  const formas = [...porForma.entries()].sort((a, b) => b[1].mensalidades + b[1].locacoes - (a[1].mensalidades + a[1].locacoes));

  const locacoes = (locs ?? []) as { valor_total: number; horas: number }[];
  const reservadoLocacoes = locacoes.reduce((s, l) => s + Number(l.valor_total), 0);
  const horasLocadas = locacoes.reduce((s, l) => s + Number(l.horas), 0);

  // Recebido pela competência (pagamentos das mensalidades do mês, em qualquer data).
  const recebidoCompetencia = mensalidades.reduce((s, m) => s + Number(m.valor_pago), 0);
  const maiorTotal = Math.max(1, ...historico.map((l) => Math.max(Number(l.previsto_mensalidades), Number(l.total_recebido))));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-verde-900">Relatório mensal</h1>
          <p className="mt-1 text-tinta-suave">Previsto x recebido, inadimplência e receita por modalidade e plano.</p>
        </div>
        <NavegarMes mes={mes} base="/admin/financeiro/relatorio" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          rotulo="Previsto (mensalidades)"
          valor={moeda(atual.previsto_mensalidades)}
          detalhe={`${atual.qtd_mensalidades} mensalidades · ${atual.qtd_pagas} pagas`}
        />
        <Indicador
          rotulo="Recebido no mês"
          valor={moeda(atual.total_recebido)}
          detalhe={`Mensalidades ${moeda(atual.recebido_mensalidades)} · Locações ${moeda(atual.recebido_locacoes)}`}
          cor="verde"
        />
        <Indicador
          rotulo="Em aberto do mês"
          valor={moeda(atual.em_aberto)}
          detalhe={
            Number(atual.previsto_mensalidades) > 0
              ? `${Math.round((recebidoCompetencia / Number(atual.previsto_mensalidades)) * 100)}% do previsto já pago`
              : undefined
          }
          cor="sol"
        />
        <Indicador
          rotulo="Inadimplente"
          valor={moeda(atual.inadimplente)}
          detalhe="Vencido e não pago desta competência"
          cor={Number(atual.inadimplente) > 0 ? "erro" : "neutro"}
        />
      </div>

      <p className="mb-6 rounded-2xl bg-areia-100 px-4 py-3 text-xs text-tinta-suave">
        <strong className="text-verde-900">Como ler:</strong> &quot;Previsto&quot;, &quot;Em aberto&quot; e os quadros por
        modalidade/plano usam a competência (mensalidades de {rotuloMes(mes)}, pagas em qualquer data). &quot;Recebido no
        mês&quot; e as formas de pagamento são caixa: tudo que entrou entre o dia 1 e o fim de {rotuloMes(mes)}, inclusive
        atrasados de outros meses.
      </p>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <TabelaGrupos titulo="Por modalidade" grupos={porModalidade} />
        <TabelaGrupos titulo="Por plano" grupos={porPlano} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Painel titulo="Recebido por forma de pagamento">
          {formas.length === 0 ? (
            <Vazio>Nenhum pagamento registrado em {rotuloMes(mes)}.</Vazio>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-tinta-suave">
                <tr>
                  <th className="pb-2 font-bold">Forma</th>
                  <th className="pb-2 text-right font-bold">Mensalidades</th>
                  <th className="pb-2 text-right font-bold">Locações</th>
                  <th className="pb-2 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-areia-100">
                {formas.map(([forma, v]) => (
                  <tr key={forma}>
                    <td className="py-2 font-semibold text-verde-900">{FORMAS_PAGAMENTO[forma]}</td>
                    <td className="py-2 text-right">{moeda(v.mensalidades)}</td>
                    <td className="py-2 text-right">{moeda(v.locacoes)}</td>
                    <td className="py-2 text-right font-bold">{moeda(v.mensalidades + v.locacoes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Painel>

        <Painel titulo="Locação de quadras">
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Reservas</dt>
              <dd className="mt-1 font-display text-xl font-semibold text-verde-900">{locacoes.length}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Horas</dt>
              <dd className="mt-1 font-display text-xl font-semibold text-verde-900">{horasLocadas.toLocaleString("pt-BR")}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Recebido</dt>
              <dd className="mt-1 font-display text-xl font-semibold text-verde-700">{moeda(atual.recebido_locacoes)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-tinta-suave">
            Valor das reservas do mês: {moeda(reservadoLocacoes)}. Os números entram aqui sozinhos quando as locações forem
            registradas no módulo de locação (o pagamento de uma locação conta no recebido do mês).
          </p>
        </Painel>
      </div>

      <Painel titulo="Últimos 6 meses">
        {historico.length === 0 ? (
          <Vazio>Sem movimento nos últimos meses.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-tinta-suave">
                <tr>
                  <th className="pb-2 font-bold">Mês</th>
                  <th className="pb-2 text-right font-bold">Previsto</th>
                  <th className="pb-2 text-right font-bold">Recebido</th>
                  <th className="pb-2 text-right font-bold">Locações</th>
                  <th className="pb-2 text-right font-bold">Inadimplente</th>
                  <th className="w-40 pb-2 pl-4 font-bold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-areia-100">
                {historico.map((l) => {
                  const m = l.mes.slice(0, 7);
                  return (
                    <tr key={l.mes} className={m === mes ? "bg-sol-400/10" : undefined}>
                      <td className="py-2">
                        <Link href={`/admin/financeiro/relatorio?mes=${m}`} className="font-semibold text-verde-900 hover:underline">
                          {rotuloMesCurto(m)}
                        </Link>
                      </td>
                      <td className="py-2 text-right">{moeda(l.previsto_mensalidades)}</td>
                      <td className="py-2 text-right font-semibold text-verde-700">{moeda(l.total_recebido)}</td>
                      <td className="py-2 text-right text-tinta-suave">{moeda(l.recebido_locacoes)}</td>
                      <td className={`py-2 text-right ${Number(l.inadimplente) > 0 ? "text-erro" : "text-tinta-suave"}`}>
                        {moeda(l.inadimplente)}
                      </td>
                      <td className="py-2 pl-4">
                        <div className="flex flex-col gap-1">
                          <Barra parte={Number(l.previsto_mensalidades)} total={maiorTotal} cor="bg-areia-300" />
                          <Barra parte={Number(l.total_recebido)} total={maiorTotal} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-tinta-suave">
              Barras: <span className="font-semibold">areia</span> = previsto, <span className="font-semibold text-verde-700">verde</span> = recebido.
            </p>
          </div>
        )}
      </Painel>
    </>
  );
}
