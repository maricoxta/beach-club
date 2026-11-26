import { formatarData } from "@/lib/agenda/datas";
import { Cartao, Vazio } from "./ui";

export type ResumoProfessor = {
  professor_id: string;
  professor: string;
  avaliacoes: number;
  media: number | null;
  mes_recente: string | null;
  avaliacoes_mes: number;
  media_mes: number | null;
};

// Vem da RPC avaliacoes_liberadas: sem aula, sem data e sem ordem de chegada (anonimato).
export type AvaliacaoAula = {
  professor_id: string;
  professor: string;
  mes: string;
  nota: number;
  comentario: string | null;
};

export const REGRA_ANONIMATO =
  "Para ninguém descobrir quem deu cada nota, elas aparecem agrupadas por mês, depois que o mês fecha (mais 7 dias do prazo para avaliar) e só quando o professor recebeu pelo menos 3 avaliações naquele mês.";

export function Estrelas({ nota }: { nota: number }) {
  const cheia = Math.round(nota);
  return (
    <span className="text-sol-400" aria-label={`${nota} de 5`}>
      {"★".repeat(cheia)}
      <span className="text-areia-200">{"★".repeat(5 - cheia)}</span>
    </span>
  );
}

export function CartoesResumo({ resumo }: { resumo: ResumoProfessor[] }) {
  if (resumo.length === 0) return <Vazio>Nenhuma avaliação liberada ainda.</Vazio>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {resumo.map((r) => (
        <Cartao key={r.professor_id}>
          <p className="text-xs font-bold uppercase tracking-wide text-sol-500">{r.professor}</p>
          <p className="font-display text-3xl font-semibold text-verde-900">
            {r.media?.toFixed(1).replace(".", ",") ?? "—"} <span className="text-base"><Estrelas nota={Number(r.media ?? 0)} /></span>
          </p>
          <p className="text-sm text-tinta-suave">
            {r.avaliacoes} avaliaç{r.avaliacoes === 1 ? "ão" : "ões"}
            {r.mes_recente &&
              ` · ${formatarData(r.mes_recente, { month: "long", year: "numeric" })}: ${r.media_mes?.toString().replace(".", ",")} (${r.avaliacoes_mes})`}
          </p>
        </Cartao>
      ))}
    </div>
  );
}

export function ListaAvaliacoes({ itens, mostrarProfessor }: { itens: AvaliacaoAula[]; mostrarProfessor?: boolean }) {
  if (itens.length === 0) return null;
  // A RPC já devolve por mês e professor, sem a ordem de chegada.
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((a, i) => (
        <li key={`${a.professor_id}-${a.mes}-${i}`} className="rounded-2xl border border-areia-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Estrelas nota={a.nota} />
            <span className="text-xs capitalize text-tinta-suave">
              {formatarData(a.mes, { month: "long", year: "numeric" })}
              {mostrarProfessor && ` · ${a.professor}`}
            </span>
          </div>
          {a.comentario && <p className="mt-1 text-tinta">“{a.comentario}”</p>}
        </li>
      ))}
    </ul>
  );
}
