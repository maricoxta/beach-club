import Link from "next/link";
import { DIAS_SEMANA, formatarData, inicioDaSemana } from "@/lib/agenda/datas";

export type Contagem = { total: number; canceladas: number; realizadas: number; modalidades: Set<string> };

// Cor de cada modalidade no calendário (bolinhas).
function corModalidade(nome: string) {
  return nome.toLowerCase().includes("vôlei") || nome.toLowerCase().includes("volei") ? "bg-sol-400" : "bg-verde-600";
}

// Mês em grade (seg a dom). Cada linha é uma semana clicável que abre a agenda daquela semana.
export function CalendarioMes({
  mes,
  hoje: dia,
  semanas,
  porDia,
}: {
  mes: string;
  hoje: string;
  semanas: string[][];
  porDia: Map<string, Contagem>;
}) {
  const modalidades = [...new Set([...porDia.values()].flatMap((c) => [...c.modalidades]))].sort();
  const semanaAtual = inicioDaSemana(dia);
  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-areia-200 bg-white">
        <div className="grid grid-cols-7 border-b border-areia-200 bg-areia-100 text-center text-xs font-bold uppercase tracking-wide text-verde-900">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <div key={d} className="py-2">
              {DIAS_SEMANA[d].curto}
            </div>
          ))}
        </div>
        {semanas.map((dias) => {
          const segunda = dias[0];
          const total = dias.reduce((s, d) => s + (porDia.get(d)?.total ?? 0), 0);
          const atual = segunda === semanaAtual;
          return (
            <Link
              key={segunda}
              href={`/admin/agenda?semana=${segunda}`}
              title={`Abrir a semana de ${formatarData(segunda)} a ${formatarData(dias[6])}${total ? ` (${total} aulas)` : ""}`}
              className={`group relative grid grid-cols-7 border-b border-areia-100 transition last:border-0 hover:bg-sol-400/15 ${
                atual ? "bg-verde-50" : ""
              }`}
            >
              {dias.map((d) => {
                const c = porDia.get(d);
                const foraDoMes = !d.startsWith(mes);
                const ehHoje = d === dia;
                return (
                  <div key={d} className={`flex min-h-20 flex-col gap-1 p-1.5 sm:min-h-24 sm:p-2 ${foraDoMes ? "opacity-40" : ""}`}>
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${
                        ehHoje ? "bg-verde-700 text-white" : "text-verde-900"
                      }`}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {c && (
                      <>
                        <span className="text-[11px] font-semibold leading-tight text-tinta-suave sm:text-xs">
                          {c.total - c.canceladas} aula{c.total - c.canceladas === 1 ? "" : "s"}
                        </span>
                        <span className="flex flex-wrap gap-0.5">
                          {[...c.modalidades].map((m) => (
                            <span key={m} className={`h-1.5 w-1.5 rounded-full ${corModalidade(m)}`} title={m} />
                          ))}
                          {c.canceladas > 0 && <span className="h-1.5 w-1.5 rounded-full bg-erro" title="Cancelada" />}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
              <span className="pointer-events-none absolute right-2 top-2 hidden rounded-full bg-verde-700 px-2.5 py-0.5 text-xs font-bold text-white group-hover:block">
                Abrir semana →
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-tinta-suave">
        {modalidades.map((m) => (
          <span key={m} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${corModalidade(m)}`} /> {m}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-erro" /> Aula cancelada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-verde-50 ring-1 ring-areia-200" /> Semana atual
        </span>
      </div>
    </>
  );
}
