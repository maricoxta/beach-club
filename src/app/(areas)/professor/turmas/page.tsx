import type { Metadata } from "next";
import { BarraVagas, Cabecalho, Cartao, Etiqueta, Vazio } from "@/components/agenda/ui";
import { alunosDaTurma, listarTurmas } from "@/lib/agenda/consultas";
import { DIAS_SEMANA, faixaHorario } from "@/lib/agenda/datas";
import { getSessao } from "@/lib/sessao";

export const instant = false;
export const metadata: Metadata = { title: "Minhas turmas" };

export default async function MinhasTurmasPage() {
  const { perfil } = await getSessao();
  const turmas = perfil ? await listarTurmas({ ativas: true, professorId: perfil.id }) : [];
  const alunos = await Promise.all(turmas.map((t) => alunosDaTurma(t.id)));

  return (
    <>
      <Cabecalho titulo="Minhas turmas" subtitulo="Seus horários fixos da semana e os alunos de cada turma." />
      {turmas.length === 0 ? (
        <Vazio>Você ainda não tem turmas. A recepção cadastra as turmas e os professores.</Vazio>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {turmas.map((t, i) => (
            <Cartao key={t.id}>
              <p className="text-xs font-bold uppercase tracking-wide text-sol-500">
                {DIAS_SEMANA[t.dia_semana].longo} · {faixaHorario(t.hora_inicio, t.hora_fim)}
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-verde-900">{t.nome}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {t.modalidade && <Etiqueta>{t.modalidade.nome}</Etiqueta>}
                {t.nivel && <Etiqueta>{t.nivel.nome}</Etiqueta>}
                {t.quadra && <Etiqueta>{t.quadra.nome}</Etiqueta>}
                <span className="ml-auto">
                  <BarraVagas ocupadas={alunos[i].length} vagas={t.vagas} />
                </span>
              </div>
              {alunos[i].length === 0 ? (
                <p className="mt-4 text-sm text-tinta-suave">Nenhum aluno matriculado.</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-1 text-sm">
                  {alunos[i].map((a) => (
                    <li key={a.aluno_id} className="flex justify-between gap-2 border-t border-areia-100 pt-1.5">
                      <span className="font-semibold text-tinta">{a.nome}</span>
                      {a.telefone && <span className="text-xs text-tinta-suave">{a.telefone}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          ))}
        </div>
      )}
    </>
  );
}
