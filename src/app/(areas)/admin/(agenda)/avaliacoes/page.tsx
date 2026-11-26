import type { Metadata } from "next";
import { CartoesResumo, Estrelas, ListaAvaliacoes, REGRA_ANONIMATO, type AvaliacaoAula, type ResumoProfessor } from "@/components/agenda/avaliacoes";
import { Cabecalho, Cartao, Vazio } from "@/components/agenda/ui";
import { formatarData } from "@/lib/agenda/datas";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "Avaliações" };

type AvaliacaoAluno = {
  id: string;
  aluno_id: string;
  modalidade_id: string;
  mes: string;
  nota: number;
  comentario: string;
  aluno: { nome: string } | null;
  professor: { nome: string } | null;
  nivel: { nome: string } | null;
  modalidade: { nome: string } | null;
};

export default async function AvaliacoesAdminPage() {
  const supabase = await createClient();
  const [resumoRes, itensRes, niveisRes] = await Promise.all([
    supabase.rpc("resumo_avaliacoes"),
    supabase.rpc("avaliacoes_liberadas").limit(300),
    supabase
      .from("avaliacoes_aluno")
      .select(
        "id, aluno_id, modalidade_id, mes, nota, comentario, aluno:perfis!aluno_id(nome), professor:perfis!professor_id(nome), nivel:niveis(nome), modalidade:modalidades(nome)",
      )
      .order("mes", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);
  for (const r of [resumoRes, itensRes, niveisRes]) if (r.error) console.error("[agenda] avaliacoes admin:", r.error.code, r.error.message);
  const alunos = (niveisRes.data ?? []) as unknown as AvaliacaoAluno[];
  // A última avaliação de cada aluno em cada modalidade decide se ele pode subir de nível.
  const vistos = new Set<string>();
  const ultimas = alunos.filter((a) => {
    const k = `${a.aluno_id}:${a.modalidade_id}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  const aptos = ultimas.filter((a) => a.nota === 5);

  return (
    <>
      <Cabecalho titulo="Avaliações" subtitulo="Notas anônimas que os alunos deram às aulas e a avaliação mensal que os professores fazem dos alunos." />
      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-semibold text-verde-900">Aulas, por professor</h2>
        <div className="mb-4">
          <CartoesResumo resumo={(resumoRes.data ?? []) as ResumoProfessor[]} />
          <p className="mt-2 text-xs text-tinta-suave">{REGRA_ANONIMATO}</p>
        </div>
        <ListaAvaliacoes itens={(itensRes.data ?? []) as unknown as AvaliacaoAula[]} mostrarProfessor />
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold text-verde-900">Avaliação mensal dos alunos</h2>
        <p className="mb-3 text-sm text-tinta-suave">
          O professor dá de 1 a 5 estrelas sobre o desempenho no nível atual. Só pode passar para uma turma de nível acima quem tem a última avaliação com 5 estrelas; o sistema bloqueia a troca nos outros casos.
        </p>
        {alunos.length === 0 ? (
          <Vazio>Nenhum professor avaliou alunos ainda. Eles avaliam em “Avaliar alunos”, uma vez por mês.</Vazio>
        ) : (
          <>
            {aptos.length > 0 && (
              <Cartao className="mb-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-sol-500">Aptos a subir de nível</p>
                <ul className="flex flex-wrap gap-2 text-sm">
                  {aptos.map((a) => (
                    <li key={a.id} className="rounded-full bg-verde-50 px-3 py-1 font-semibold text-verde-700">
                      {a.aluno?.nome} · {a.modalidade?.nome} ({a.nivel?.nome})
                    </li>
                  ))}
                </ul>
              </Cartao>
            )}
            <Cartao>
              <ul className="flex flex-col divide-y divide-areia-100 text-sm">
                {alunos.map((a) => (
                  <li key={a.id} className="py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-tinta">
                        {a.aluno?.nome}{" "}
                        <span className="ml-1 rounded-full bg-verde-50 px-2 py-0.5 text-xs font-bold text-verde-700">
                          {a.modalidade?.nome} · {a.nivel?.nome}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-tinta-suave">
                        <Estrelas nota={a.nota} />
                        <span className="capitalize">{formatarData(a.mes, { month: "short", year: "numeric" })}</span>
                        {a.professor && `· ${a.professor.nome}`}
                      </span>
                    </div>
                    <p className="mt-1 text-tinta-suave">{a.comentario}</p>
                  </li>
                ))}
              </ul>
            </Cartao>
          </>
        )}
      </section>
    </>
  );
}
