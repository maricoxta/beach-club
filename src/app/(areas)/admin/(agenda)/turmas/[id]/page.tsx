import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso, BarraVagas, Cabecalho, Cartao, LinkVoltar } from "@/components/agenda/ui";
import { alunosDaTurma, buscarTurma, listarAulas, opcoesCadastro } from "@/lib/agenda/consultas";
import { DIAS_SEMANA, faixaHorario, formatarData, hoje, somarDias } from "@/lib/agenda/datas";
import { rotuloStatusAula } from "@/lib/agenda/tipos";
import { salvarTurma } from "../../acoes";
import { FormTurma } from "../form-turma";
import { BotaoAtivo } from "./botao-ativo";

export const instant = false;
export const metadata: Metadata = { title: "Turma" };

export default async function TurmaPage({ params, searchParams }: PageProps<"/admin/turmas/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const turma = await buscarTurma(id);
  if (!turma) notFound();

  const dia = hoje();
  const [opcoes, alunos, proximas] = await Promise.all([
    opcoesCadastro(),
    alunosDaTurma(id),
    listarAulas({ de: dia, ate: somarDias(dia, 28), turmaIds: [id] }),
  ]);
  // Professor/quadra inativos continuam aparecendo no select desta turma.
  const comAtual = (lista: { id: string; nome: string }[], atualId: string, nome?: string) =>
    lista.some((o) => o.id === atualId) ? lista : [{ id: atualId, nome: `${nome ?? "Atual"} (inativo)` }, ...lista];

  return (
    <>
      <LinkVoltar href="/admin/turmas">Turmas</LinkVoltar>
      <Cabecalho
        titulo={turma.nome}
        subtitulo={`${DIAS_SEMANA[turma.dia_semana].longo}, ${faixaHorario(turma.hora_inicio, turma.hora_fim)} · ${turma.professor?.nome ?? ""} · ${turma.quadra?.nome ?? ""}`}
        acoes={<BotaoAtivo id={id} ativo={turma.ativo} />}
      />
      {sp.criada === "1" && (
        <div className="mb-4">
          <Aviso tipo="ok">
            Turma criada! Gere as aulas na <Link href="/admin/agenda" className="underline">agenda</Link> e matricule os alunos.
          </Aviso>
        </div>
      )}
      {!turma.ativo && (
        <div className="mb-4">
          <Aviso tipo="erro">Turma inativa: não gera novas aulas e libera a quadra e o professor nesse horário.</Aviso>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Cartao>
          <h2 className="mb-4 font-display text-lg font-semibold text-verde-900">Dados da turma</h2>
          <FormTurma
            acao={salvarTurma.bind(null, id)}
            valores={turma}
            opcoes={{
              ...opcoes,
              professores: comAtual(opcoes.professores, turma.professor_id, turma.professor?.nome),
              quadras: comAtual(opcoes.quadras, turma.quadra_id, turma.quadra?.nome),
            }}
          />
        </Cartao>

        <aside className="flex flex-col gap-4">
          <Cartao>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-verde-900">Alunos</h2>
              <BarraVagas ocupadas={alunos.length} vagas={turma.vagas} />
            </div>
            {alunos.length === 0 ? (
              <p className="text-sm text-tinta-suave">Nenhum aluno matriculado ainda.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {alunos.map((a) => (
                  <li key={a.aluno_id} className="flex justify-between gap-2">
                    <span className="font-semibold text-tinta">{a.nome}</span>
                    <span className="text-xs text-tinta-suave">desde {formatarData(a.data_inicio)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <Cartao>
            <h2 className="mb-3 font-display text-lg font-semibold text-verde-900">Próximas aulas</h2>
            {proximas.length === 0 ? (
              <p className="text-sm text-tinta-suave">Nenhuma aula gerada nas próximas 4 semanas.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {proximas.map((a) => (
                  <li key={a.id}>
                    <Link href={`/admin/agenda/aulas/${a.id}`} className="flex justify-between gap-2 hover:underline">
                      <span>{formatarData(a.data, { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                      <span className={a.status === "cancelada" ? "text-erro" : "text-tinta-suave"}>{rotuloStatusAula[a.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </aside>
      </div>
    </>
  );
}
