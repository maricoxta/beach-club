import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormChamada } from "@/components/agenda/form-chamada";
import { Cartao, Etiqueta, LinkVoltar, SeloStatus } from "@/components/agenda/ui";
import { salvarChamada } from "@/lib/agenda/acoes-chamada";
import { buscarAula, listaChamada, opcoesCadastro } from "@/lib/agenda/consultas";
import { faixaHorario, formatarDataLonga, inicioDaSemana } from "@/lib/agenda/datas";
import { createClient } from "@/lib/supabase/server";
import { adicionarAvulso, atualizarAula } from "../../../acoes";
import { FormAula, FormAvulso } from "./forms";

export const instant = false;
export const metadata: Metadata = { title: "Aula" };

export default async function AulaAdminPage({ params }: PageProps<"/admin/agenda/aulas/[id]">) {
  const { id } = await params;
  const aula = await buscarAula(id);
  if (!aula || !aula.turma) notFound();

  const supabase = await createClient();
  const [lista, opcoes, alunos] = await Promise.all([
    listaChamada(id),
    opcoesCadastro(),
    supabase.from("perfis").select("id, nome").eq("papel", "aluno").eq("ativo", true).order("nome"),
  ]);
  const naLista = new Set(lista.map((i) => i.aluno_id));
  const avulsos = ((alunos.data ?? []) as { id: string; nome: string }[]).filter((a) => !naLista.has(a.id));
  const t = aula.turma;

  return (
    <>
      <LinkVoltar href={`/admin/agenda?semana=${inicioDaSemana(aula.data)}`}>Voltar para a agenda</LinkVoltar>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold capitalize text-sol-500">{formatarDataLonga(aula.data)}</p>
          <h1 className="font-display text-3xl font-semibold text-verde-900">{t.nome}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <SeloStatus status={aula.status} />
            {t.modalidade && <Etiqueta>{t.modalidade.nome}</Etiqueta>}
            {t.nivel && <Etiqueta>{t.nivel.nome}</Etiqueta>}
            <Etiqueta>{faixaHorario(t.hora_inicio, t.hora_fim)}</Etiqueta>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-verde-900">Chamada</h2>
          {aula.status === "cancelada" ? (
            <Cartao>Aula cancelada. Reative a aula para lançar presença.</Cartao>
          ) : lista.length === 0 ? (
            <Cartao>Nenhum aluno matriculado nesta turma na data da aula. Adicione um aluno avulso ao lado.</Cartao>
          ) : (
            <FormChamada lista={lista} acao={salvarChamada.bind(null, id)} aulaAgendada={aula.status === "agendada"} />
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <Cartao>
            <h2 className="mb-3 font-display text-lg font-semibold text-verde-900">Dados da aula</h2>
            <FormAula
              acao={atualizarAula.bind(null, id)}
              aula={{
                status: aula.status,
                professor_id: aula.professor_id ?? t.professor_id,
                quadra_id: aula.quadra_id ?? t.quadra_id,
                observacao: aula.observacao ?? "",
              }}
              professores={opcoes.professores}
              quadras={opcoes.quadras}
            />
          </Cartao>
          {aula.status !== "cancelada" && (
            <Cartao>
              <h2 className="mb-1 font-display text-lg font-semibold text-verde-900">Reposição ou aula avulsa</h2>
              <p className="mb-3 text-sm text-tinta-suave">Inclui na chamada um aluno que não é desta turma.</p>
              <FormAvulso acao={adicionarAvulso.bind(null, id)} alunos={avulsos} />
            </Cartao>
          )}
        </aside>
      </div>
    </>
  );
}
