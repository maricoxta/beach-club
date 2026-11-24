import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormChamada } from "@/components/agenda/form-chamada";
import { Cartao, Etiqueta, LinkVoltar, SeloStatus } from "@/components/agenda/ui";
import { salvarChamada } from "@/lib/agenda/acoes-chamada";
import { buscarAula, listaChamada } from "@/lib/agenda/consultas";
import { faixaHorario, formatarDataLonga } from "@/lib/agenda/datas";

export const instant = false;
export const metadata: Metadata = { title: "Chamada" };

export default async function ChamadaProfessorPage({ params }: PageProps<"/professor/aulas/[id]">) {
  const { id } = await params;
  // O RLS só devolve aulas do próprio professor; de outro professor vira 404.
  const aula = await buscarAula(id);
  if (!aula || !aula.turma) notFound();
  const lista = aula.status === "cancelada" ? [] : await listaChamada(id);
  const t = aula.turma;

  return (
    <div className="max-w-3xl">
      <LinkVoltar href="/professor">Minhas aulas</LinkVoltar>
      <p className="text-sm font-semibold capitalize text-sol-500">{formatarDataLonga(aula.data)}</p>
      <h1 className="font-display text-3xl font-semibold text-verde-900">{t.nome}</h1>
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-1.5">
        <SeloStatus status={aula.status} />
        <Etiqueta>{faixaHorario(t.hora_inicio, t.hora_fim)}</Etiqueta>
        <Etiqueta>{aula.quadra?.nome ?? t.quadra?.nome}</Etiqueta>
        {t.nivel && <Etiqueta>{t.nivel.nome}</Etiqueta>}
      </div>
      {aula.observacao && <p className="mb-4 text-sm text-tinta-suave">Obs.: {aula.observacao}</p>}

      {aula.status === "cancelada" ? (
        <Cartao>Esta aula foi cancelada pela recepção.</Cartao>
      ) : lista.length === 0 ? (
        <Cartao>Nenhum aluno matriculado nesta turma na data da aula. Para reposição, peça à recepção.</Cartao>
      ) : (
        <FormChamada lista={lista} acao={salvarChamada.bind(null, id)} aulaAgendada={aula.status === "agendada"} />
      )}
    </div>
  );
}
