import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho, Cartao, Etiqueta, Vazio } from "@/components/agenda/ui";
import { PainelLiberacao, SeloLiberacao, type LinhaVagas } from "@/components/agenda/liberacao";
import { agora, DIAS_SEMANA, diaSemanaIso, faixaHorario, formatarData, formatarDataHora, hoje, somarDias } from "@/lib/agenda/datas";
import { BotoesDecisao } from "@/components/agenda/desmarcacoes-pendentes";
import { desmarcacoesPendentes } from "@/lib/agenda/consultas";
import { createClient } from "@/lib/supabase/server";
import { decidirDesmarcacao, liberarVagas } from "../acoes";

export const instant = false;
export const metadata: Metadata = { title: "Vagas para reposição" };

const PERIODOS = [7, 14, 30];

export default async function VagasPage({ searchParams }: PageProps<"/admin/vagas">) {
  const sp = await searchParams;
  const dias = PERIODOS.includes(Number(sp.dias)) ? Number(sp.dias) : 14;
  const filtro = sp.filtro === "liberadas" ? "liberadas" : "todas";
  const supabase = await createClient();
  const dia = hoje();
  const [{ data, error }, pendentes] = await Promise.all([
    supabase.rpc("painel_vagas", { p_de: dia, p_ate: somarDias(dia, dias) }),
    desmarcacoesPendentes(),
  ]);
  if (error) console.error("[agenda] painel_vagas:", error.code, error.message);
  const agoraMs = agora();
  const linhas = ((data ?? []) as LinhaVagas[]).filter((l) => filtro === "todas" || l.liberadas);

  const porData = new Map<string, LinhaVagas[]>();
  for (const l of linhas) porData.set(l.data, [...(porData.get(l.data) ?? []), l]);

  const link = (d: number, f: string) => `/admin/vagas?dias=${d}${f === "liberadas" ? "&filtro=liberadas" : ""}`;
  const pilula = (ativo: boolean) =>
    `rounded-full px-3 py-1 text-sm font-semibold transition ${ativo ? "bg-verde-700 text-white" : "border border-areia-300 bg-white text-verde-800 hover:border-verde-700"}`;

  return (
    <>
      <Cabecalho
        titulo="Vagas para reposição"
        subtitulo="Escolha quantas vagas livres cada aula oferece para reposição e aula extra, e quando os alunos passam a ver. Ao liberar, os alunos da mesma modalidade e nível recebem um aviso no app e quem reservar primeiro fica com a vaga."
      />
      {pendentes.length > 0 && (
        <section className="mb-8 rounded-3xl border-2 border-sol-400 bg-sol-400/10 p-5">
          <h2 className="font-display text-xl font-semibold text-verde-900">
            {pendentes.length === 1 ? "1 aluno desmarcou" : `${pendentes.length} alunos desmarcaram`}: libera a vaga?
          </h2>
          <p className="mb-4 text-sm text-tinta-suave">
            &quot;Liberar vaga&quot; abre 1 vaga para reposição agora e avisa os alunos do mesmo nível. Para escolher outra data ou quantidade, use o cartão da aula logo abaixo.
          </p>
          <ul className="flex flex-col gap-3">
            {pendentes.map((p) => (
              <li key={p.presenca_id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-semibold text-tinta">
                    {p.aluno} desmarcou {p.turma}
                  </p>
                  <p className="text-tinta-suave">
                    {DIAS_SEMANA[diaSemanaIso(p.data)].longo}, {formatarData(p.data)} · {faixaHorario(p.hora_inicio, p.hora_fim)}
                    {p.professor && ` · ${p.professor}`} · {p.vagas_livres} vaga{p.vagas_livres === 1 ? "" : "s"} livre{p.vagas_livres === 1 ? "" : "s"}
                    {p.liberadas ? ` · ${p.liberadas} já liberada${p.liberadas === 1 ? "" : "s"}` : ""}
                  </p>
                  <p className="text-xs text-tinta-suave">Desmarcou {formatarDataHora(p.desmarcada_em)}</p>
                </div>
                <BotoesDecisao presencaId={p.presenca_id} decidir={decidirDesmarcacao} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PERIODOS.map((d) => (
          <Link key={d} href={link(d, filtro)} className={pilula(d === dias)}>
            Próximos {d} dias
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-areia-300" />
        <Link href={link(dias, "todas")} className={pilula(filtro === "todas")}>Com vaga livre</Link>
        <Link href={link(dias, "liberadas")} className={pilula(filtro === "liberadas")}>Só liberadas</Link>
      </div>

      {error ? (
        <Vazio>Não foi possível carregar as vagas. Tente de novo em instantes.</Vazio>
      ) : linhas.length === 0 ? (
        <Vazio>{filtro === "liberadas" ? "Nenhuma vaga liberada neste período." : "Nenhuma aula com vaga livre neste período."}</Vazio>
      ) : (
        <div className="flex flex-col gap-8">
          {[...porData.entries()].map(([d, lista]) => (
            <section key={d}>
              <h2 className="mb-3 font-display text-lg font-semibold text-verde-900">
                {d === dia ? "Hoje" : `${DIAS_SEMANA[diaSemanaIso(d)].longo}, ${formatarData(d)}`}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {lista.map((l) => (
                  <Cartao key={l.aula_id} className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-lg font-semibold text-verde-900">{faixaHorario(l.hora_inicio, l.hora_fim)}</p>
                        <Link href={`/admin/agenda/aulas/${l.aula_id}`} className="font-semibold text-tinta hover:text-verde-700 hover:underline">
                          {l.turma}
                        </Link>
                      </div>
                      <SeloLiberacao linha={l} agoraMs={agoraMs} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Etiqueta>{l.modalidade}</Etiqueta>
                      <Etiqueta>{l.nivel}</Etiqueta>
                      {l.professor && <Etiqueta>{l.professor}</Etiqueta>}
                    </div>
                    <PainelLiberacao linha={l} agoraMs={agoraMs} acao={liberarVagas.bind(null, l.aula_id)} />
                  </Cartao>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
