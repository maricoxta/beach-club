import Link from "next/link";
import { formatarDataHora } from "@/lib/agenda/datas";
import { Estrelas } from "./avaliacoes";
import { Cartao } from "./ui";

export type ItemCheckin = {
  aluno_id: string;
  nome: string;
  tipo: "turma" | "reposicao" | "extra" | "avulso";
  situacao: "confirmado" | "sem_checkin" | "desmarcou";
  checkin_em: string | null;
  ultima_nota: number | null;
};

const rotuloTipo: Record<ItemCheckin["tipo"], string | null> = {
  turma: null,
  reposicao: "Reposição",
  extra: "Aula extra",
  avulso: "Avulso",
};

const grupos: { situacao: ItemCheckin["situacao"]; titulo: string; cor: string }[] = [
  { situacao: "confirmado", titulo: "Fizeram check-in", cor: "bg-verde-50 text-verde-700" },
  { situacao: "sem_checkin", titulo: "Sem check-in", cor: "bg-areia-100 text-tinta-suave" },
  { situacao: "desmarcou", titulo: "Desmarcaram", cor: "bg-erro/10 text-erro" },
];

// Check-in da aula (até 2h antes), com a última avaliação mensal de cada aluno.
export function ListaCheckin({ lista, linkAvaliar }: { lista: ItemCheckin[]; linkAvaliar?: string }) {
  const confirmados = lista.filter((i) => i.situacao === "confirmado").length;
  const esperados = lista.filter((i) => i.situacao !== "desmarcou").length;
  return (
    <Cartao>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-verde-900">Check-in</h2>
        <p className="text-sm font-semibold text-tinta-suave">
          {confirmados} de {esperados} confirmaram
        </p>
      </div>
      <p className="mb-4 text-xs text-tinta-suave">
        O aluno faz o check-in pelo app até 2 horas antes da aula. Reposição e aula extra já entram como confirmadas. As estrelas são a última avaliação mensal do aluno.
        {linkAvaliar && (
          <>
            {" "}
            <Link href={linkAvaliar} className="font-semibold text-verde-700 underline">
              Avaliar alunos do mês
            </Link>
          </>
        )}
      </p>
      <div className="flex flex-col gap-4">
        {grupos.map((g) => {
          const itens = lista.filter((i) => i.situacao === g.situacao);
          if (itens.length === 0) return null;
          return (
            <section key={g.situacao}>
              <h3 className={`mb-2 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${g.cor}`}>
                {g.titulo} ({itens.length})
              </h3>
              <ul className="flex flex-col divide-y divide-areia-100">
                {itens.map((i) => (
                  <li key={i.aluno_id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-tinta">
                        {i.nome}
                        {rotuloTipo[i.tipo] && <span className="ml-2 rounded-full bg-sol-400/25 px-2 py-0.5 text-[11px] font-bold text-verde-900">{rotuloTipo[i.tipo]}</span>}
                      </span>
                      <span className="text-xs text-tinta-suave">
                        {i.checkin_em && i.situacao === "confirmado" && `Confirmou ${formatarDataHora(i.checkin_em)}`}
                        {i.ultima_nota != null && (
                          <>
                            {" · "}
                            <Estrelas nota={i.ultima_nota} />
                          </>
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Cartao>
  );
}
