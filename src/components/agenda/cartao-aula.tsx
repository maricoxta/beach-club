import Link from "next/link";
import { formatarHora } from "@/lib/agenda/datas";
import type { Aula } from "@/lib/agenda/tipos";
import { Etiqueta, SeloStatus } from "./ui";

// Uma aula (ocorrência datada) num card compacto. Professor/quadra da aula podem diferir da turma.
export function CartaoAula({ aula, href, mostrarProfessor = true }: { aula: Aula; href?: string; mostrarProfessor?: boolean }) {
  const t = aula.turma;
  const substituto = t && aula.professor_id && aula.professor_id !== t.professor_id;
  const conteudo = (
    <div
      className={`flex flex-col gap-1.5 rounded-2xl border bg-white p-3 text-sm transition ${
        aula.status === "cancelada" ? "border-areia-200 opacity-60" : "border-areia-200 hover:border-verde-600"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="whitespace-nowrap font-display text-base font-semibold text-verde-900">
          {t ? `${formatarHora(t.hora_inicio)}–${formatarHora(t.hora_fim)}` : "—"}
        </span>
        <SeloStatus status={aula.status} />
      </div>
      <p className="font-semibold text-tinta">{t?.nome ?? "Turma"}</p>
      <div className="flex flex-wrap gap-1">
        {t?.modalidade && <Etiqueta>{t.modalidade.nome}</Etiqueta>}
        {t?.nivel && <Etiqueta>{t.nivel.nome}</Etiqueta>}
      </div>
      <p className="text-xs text-tinta-suave">
        {aula.quadra?.nome ?? t?.quadra?.nome}
        {mostrarProfessor && (aula.professor?.nome ?? t?.professor?.nome) && (
          <> · {aula.professor?.nome ?? t?.professor?.nome}{substituto && " (substituto)"}</>
        )}
      </p>
    </div>
  );
  return href ? <Link href={href}>{conteudo}</Link> : conteudo;
}
