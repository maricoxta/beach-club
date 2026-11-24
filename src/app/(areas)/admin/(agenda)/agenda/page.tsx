import type { Metadata } from "next";
import { CartaoAula } from "@/components/agenda/cartao-aula";
import { NavegarSemana } from "@/components/agenda/navegar-semana";
import { Aviso, Cabecalho, classeBotao, classeCampo, Vazio } from "@/components/agenda/ui";
import { listarAulas, listarTurmas } from "@/lib/agenda/consultas";
import { DIAS_SEMANA, diaSemanaIso, diasDaSemana, formatarData, hoje, inicioDaSemana, isData, somarDias } from "@/lib/agenda/datas";
import { gerarAulas } from "../acoes";

export const instant = false;
export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: PageProps<"/admin/agenda">) {
  const sp = await searchParams;
  const dia = hoje();
  const segunda = inicioDaSemana(isData(sp.semana) ? sp.semana : dia);
  const domingo = somarDias(segunda, 6);
  const geradas = typeof sp.geradas === "string" ? Number(sp.geradas) : null;

  const [aulas, turmasAtivas] = await Promise.all([
    listarAulas({ de: segunda, ate: domingo }),
    listarTurmas({ ativas: true }),
  ]);
  const dias = diasDaSemana(segunda);
  const faltamGerar = turmasAtivas.length > 0 && aulas.length === 0;

  return (
    <>
      <Cabecalho
        titulo="Agenda da semana"
        subtitulo="Aulas de cada turma por data. Clique numa aula para fazer a chamada, cancelar ou trocar o professor."
        acoes={<NavegarSemana segunda={segunda} base="/admin/agenda" hoje={dia} />}
      />

      {geradas !== null && (
        <div className="mb-4">
          <Aviso tipo="ok">
            {geradas > 0 ? `${geradas} aula(s) criada(s).` : "Nenhuma aula nova: as aulas desse período já existiam."}
          </Aviso>
        </div>
      )}

      <form
        action={gerarAulas}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-3xl border border-areia-200 bg-white p-4"
      >
        <input type="hidden" name="de" value={segunda} />
        <div className="flex-1 text-sm text-tinta-suave">
          <p className="font-semibold text-verde-900">Gerar aulas a partir das turmas</p>
          <p>
            Cria as aulas das turmas ativas a partir de {formatarData(segunda)}. Aulas que já existem não são duplicadas.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-tinta-suave">
          Período
          <select name="semanas" defaultValue="4" className={classeCampo}>
            <option value="1">Esta semana</option>
            <option value="2">2 semanas</option>
            <option value="4">4 semanas</option>
            <option value="8">8 semanas</option>
          </select>
        </label>
        <button className={classeBotao}>Gerar aulas</button>
      </form>

      {turmasAtivas.length === 0 ? (
        <Vazio>Nenhuma turma ativa ainda. Cadastre quadras e turmas para montar a agenda.</Vazio>
      ) : (
        <>
          {faltamGerar && (
            <div className="mb-4">
              <Aviso tipo="erro">As aulas desta semana ainda não foram geradas. Use o botão acima.</Aviso>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {dias.map((d) => {
              const doDia = aulas.filter((a) => a.data === d);
              const ehHoje = d === dia;
              return (
                <section key={d} className="flex flex-col gap-2">
                  <h2
                    className={`rounded-2xl px-3 py-2 text-sm font-bold ${
                      ehHoje ? "bg-verde-700 text-white" : "bg-areia-100 text-verde-900"
                    }`}
                  >
                    {DIAS_SEMANA[diaSemanaIso(d)].curto} {formatarData(d)}
                  </h2>
                  {doDia.length === 0 ? (
                    <p className="px-1 text-xs text-tinta-suave/70">Sem aulas</p>
                  ) : (
                    doDia.map((a) => <CartaoAula key={a.id} aula={a} href={`/admin/agenda/aulas/${a.id}`} />)
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
