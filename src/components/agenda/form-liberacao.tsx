"use client";

import { useActionState, useState } from "react";
import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";
import { somarDias } from "@/lib/agenda/datas";
import { Aviso, classeBotao, classeCampo } from "./ui";

type Acao = (estado: EstadoAcao, form: FormData) => Promise<EstadoAcao>;

// Atalhos relativos ao início da aula (não dependem do relógio).
const ATALHOS = [
  { rotulo: "1 semana antes", dias: 7 },
  { rotulo: "2 dias antes", dias: 2 },
  { rotulo: "1 dia antes", dias: 1 },
];

export function FormLiberacao({
  acao,
  data,
  horaInicio,
  maximo,
  atual,
}: {
  acao: Acao;
  data: string;
  horaInicio: string;
  maximo: number;
  atual: { vagas: number; liberarEm: string; jaValendo: boolean } | null;
}) {
  const [estado, enviar, pendente] = useActionState(acao, undefined);
  const [quando, setQuando] = useState<"agora" | "agendar">(atual && !atual.jaValendo ? "agendar" : "agora");
  const [liberarEm, setLiberarEm] = useState(atual && !atual.jaValendo ? atual.liberarEm : `${somarDias(data, -1)}T${horaInicio.slice(0, 5)}`);

  if (maximo < 1 && !atual) return <p className="text-sm text-tinta-suave">Sem vagas livres para liberar.</p>;
  return (
    <form action={enviar} className="flex flex-col gap-3 text-sm">
      <label className="flex flex-col gap-1 font-semibold">
        Vagas para reposição / aula extra
        <select name="vagas" defaultValue={String(atual?.vagas ?? Math.max(1, maximo))} className={classeCampo}>
          {Array.from({ length: Math.max(maximo, atual?.vagas ?? 0) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} vaga{n === 1 ? "" : "s"}
            </option>
          ))}
          {atual && <option value="0">Nenhuma (tirar a liberação)</option>}
        </select>
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Quando os alunos podem ver</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="quando" value="agora" checked={quando === "agora"} onChange={() => setQuando("agora")} className="accent-verde-700" />
          {atual?.jaValendo ? "Manter liberada (já está valendo)" : "Agora"}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="quando" value="agendar" checked={quando === "agendar"} onChange={() => setQuando("agendar")} className="accent-verde-700" />
          A partir de uma data e hora
        </label>
        {quando === "agendar" && (
          <div className="flex flex-col gap-2 pl-6">
            <input type="datetime-local" name="liberar_em" value={liberarEm} onChange={(e) => setLiberarEm(e.target.value)} required className={classeCampo} />
            <div className="flex flex-wrap gap-1.5">
              {ATALHOS.map((a) => (
                <button
                  key={a.dias}
                  type="button"
                  onClick={() => setLiberarEm(`${somarDias(data, -a.dias)}T${horaInicio.slice(0, 5)}`)}
                  className="rounded-full border border-areia-300 px-3 py-1 text-xs font-semibold text-verde-800 hover:border-verde-700"
                >
                  {a.rotulo}
                </button>
              ))}
            </div>
          </div>
        )}
      </fieldset>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <button disabled={pendente} className={classeBotao}>
        {pendente ? "Salvando…" : atual ? "Salvar liberação" : "Liberar vagas"}
      </button>
    </form>
  );
}
