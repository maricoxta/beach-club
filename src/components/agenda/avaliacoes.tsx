import { DIAS_SEMANA, diaSemanaIso, formatarData } from "@/lib/agenda/datas";
import { Cartao, Vazio } from "./ui";

export type ResumoProfessor = {
  professor_id: string;
  professor: string;
  avaliacoes: number;
  media: number | null;
  ultimos_30d: number;
  media_30d: number | null;
};

export type AvaliacaoAula = {
  id: string;
  nota: number;
  comentario: string | null;
  professor: { nome: string } | null;
  aula: { data: string; turma: { nome: string } | null } | null;
};

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
  if (resumo.length === 0) return <Vazio>Nenhuma avaliação de aula ainda.</Vazio>;
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
            {r.ultimos_30d > 0 && ` · últimos 30 dias: ${r.media_30d?.toString().replace(".", ",")} (${r.ultimos_30d})`}
          </p>
        </Cartao>
      ))}
    </div>
  );
}

export function ListaAvaliacoes({ itens, mostrarProfessor }: { itens: AvaliacaoAula[]; mostrarProfessor?: boolean }) {
  const ordenadas = [...itens].sort((a, b) => (b.aula?.data ?? "").localeCompare(a.aula?.data ?? ""));
  if (ordenadas.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {ordenadas.map((a) => (
        <li key={a.id} className="rounded-2xl border border-areia-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Estrelas nota={a.nota} />
            <span className="text-xs text-tinta-suave">
              {a.aula && `${DIAS_SEMANA[diaSemanaIso(a.aula.data)].curto} ${formatarData(a.aula.data)} · ${a.aula.turma?.nome ?? ""}`}
              {mostrarProfessor && a.professor && ` · ${a.professor.nome}`}
            </span>
          </div>
          {a.comentario && <p className="mt-1 text-tinta">“{a.comentario}”</p>}
        </li>
      ))}
    </ul>
  );
}

export const SELECT_AVALIACAO_AULA = "id, nota, comentario, professor:perfis!professor_id(nome), aula:aulas(data, turma:turmas(nome))";
