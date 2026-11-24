import type { Metadata } from "next";
import Link from "next/link";
import { CartaoAula } from "@/components/agenda/cartao-aula";
import { TituloArea } from "@/components/area-shell";
import { Vazio } from "@/components/agenda/ui";
import { listarAulas } from "@/lib/agenda/consultas";
import { DIAS_SEMANA, diaSemanaIso, formatarData, formatarDataLonga, hoje, somarDias } from "@/lib/agenda/datas";
import { getSessao } from "@/lib/sessao";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export const metadata: Metadata = { title: "Professor" };

export default async function ProfessorPage() {
  const { perfil } = await getSessao();
  const dia = hoje();
  // Aulas onde ele é o professor da aula (inclui substituições).
  const aulas = perfil ? await listarAulas({ de: dia, ate: somarDias(dia, 7), professorId: perfil.id }) : [];
  const deHoje = aulas.filter((a) => a.data === dia);
  const proximas = aulas.filter((a) => a.data !== dia);
  const pendentes = deHoje.filter((a) => a.status === "agendada").length;

  return (
    <>
      <TituloArea
        ola={`Bom treino, ${perfil?.nome.split(" ")[0]}!`}
        subtitulo={`${formatarDataLonga(dia)}. ${
          deHoje.length ? `Você tem ${deHoje.length} aula(s) hoje${pendentes ? `, ${pendentes} sem chamada` : ""}.` : "Nenhuma aula hoje."
        }`}
      />

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-semibold text-verde-900">Aulas de hoje</h2>
        {deHoje.length === 0 ? (
          <Vazio>Dia livre. Confira suas <Link href="/professor/turmas" className="font-semibold text-verde-700 underline">turmas</Link>.</Vazio>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deHoje.map((a) => (
              <div key={a.id} className="flex flex-col gap-2">
                <CartaoAula aula={a} href={`/professor/aulas/${a.id}`} mostrarProfessor={false} />
                {a.status === "agendada" && (
                  <Link
                    href={`/professor/aulas/${a.id}`}
                    className="rounded-full bg-sol-400 px-4 py-2 text-center text-sm font-bold text-verde-900 transition hover:bg-sol-500"
                  >
                    Fazer chamada
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-verde-900">Próximos 7 dias</h2>
        {proximas.length === 0 ? (
          <Vazio>Nenhuma aula agendada para os próximos dias.</Vazio>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {proximas.map((a) => (
              <div key={a.id}>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-sol-500">
                  {DIAS_SEMANA[diaSemanaIso(a.data)].curto} {formatarData(a.data)}
                </p>
                <CartaoAula aula={a} href={`/professor/aulas/${a.id}`} mostrarProfessor={false} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
