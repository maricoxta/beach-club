import type { Metadata } from "next";
import { Estrelas } from "@/components/agenda/avaliacoes";
import { FormAvaliacaoAluno } from "@/components/agenda/checkin";
import { Cabecalho, Cartao, Vazio } from "@/components/agenda/ui";
import { formatarData, hoje } from "@/lib/agenda/datas";
import { createClient } from "@/lib/supabase/server";
import { avaliarAluno } from "../acoes";

export const instant = false;
export const metadata: Metadata = { title: "Avaliar alunos" };

type Linha = {
  turma_id: string;
  turma: string;
  modalidade: string;
  nivel: string;
  aluno_id: string;
  aluno: string;
  nota_mes: number | null;
  comentario_mes: string | null;
  avaliado_por: string | null;
  pode_editar: boolean;
  ultima_nota: number | null;
  ultimo_mes: string | null;
};

export default async function AvaliarAlunosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("alunos_para_avaliar");
  if (error) console.error("[agenda] alunos_para_avaliar:", error.code, error.message);
  const linhas = (data ?? []) as Linha[];
  const mes = formatarData(hoje(), { month: "long", year: "numeric" });
  const turmas = [...new Map(linhas.map((l) => [l.turma_id, l])).values()];
  const pendentes = linhas.filter((l) => l.nota_mes == null).length;

  return (
    <>
      <Cabecalho
        titulo="Avaliação mensal dos alunos"
        subtitulo={`${mes}: de 1 a 5 estrelas sobre o desempenho no nível atual, com um comentário fundamentado. Só sobe de nível quem recebe 5 estrelas.${
          linhas.length ? ` ${pendentes ? `${pendentes} pendente(s).` : "Todos avaliados."}` : ""
        }`}
      />
      {turmas.length === 0 ? (
        <Vazio>Nenhum aluno matriculado nas suas turmas.</Vazio>
      ) : (
        <div className="flex flex-col gap-6">
          {turmas.map((t) => (
            <Cartao key={t.turma_id}>
              <h2 className="font-display text-xl font-semibold text-verde-900">{t.turma}</h2>
              <p className="mb-3 text-xs font-semibold text-tinta-suave">
                {t.modalidade} · {t.nivel}
              </p>
              <ul className="flex flex-col divide-y divide-areia-100">
                {linhas
                  .filter((l) => l.turma_id === t.turma_id)
                  .map((l) => (
                    <li key={l.aluno_id} className="py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-tinta">{l.aluno}</span>
                        {l.nota_mes != null ? (
                          <span className="flex items-center gap-2 text-xs text-tinta-suave">
                            <Estrelas nota={l.nota_mes} />
                            {l.nota_mes === 5 && <span className="rounded-full bg-verde-50 px-2 py-0.5 font-bold text-verde-700">Apto a subir</span>}
                            {l.avaliado_por && `por ${l.avaliado_por}`}
                          </span>
                        ) : (
                          <span className="rounded-full bg-sol-400/25 px-2 py-0.5 text-xs font-bold text-verde-900">Pendente este mês</span>
                        )}
                      </div>
                      {l.comentario_mes && <p className="mt-1 text-tinta-suave">“{l.comentario_mes}”</p>}
                      {l.nota_mes == null && l.ultima_nota != null && l.ultimo_mes && (
                        <p className="mt-1 text-xs text-tinta-suave">
                          Última: <Estrelas nota={l.ultima_nota} /> em {formatarData(l.ultimo_mes, { month: "long", year: "numeric" })}
                        </p>
                      )}
                      {l.pode_editar && (
                        <details className="mt-1" open={l.nota_mes == null && linhas.length <= 3}>
                          <summary className="cursor-pointer text-xs font-semibold text-verde-700 hover:underline">
                            {l.nota_mes == null ? "Avaliar" : "Corrigir avaliação"}
                          </summary>
                          <FormAvaliacaoAluno acao={avaliarAluno.bind(null, l.aluno_id, l.turma_id)} nota={l.nota_mes} comentario={l.comentario_mes} />
                        </details>
                      )}
                    </li>
                  ))}
              </ul>
            </Cartao>
          ))}
        </div>
      )}
    </>
  );
}
