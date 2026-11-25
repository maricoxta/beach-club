"use client";

import { useActionState, useState } from "react";
import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";
import { Aviso, classeBotao, classeCampo } from "./ui";

type Acao = (estado: EstadoAcao, form: FormData) => Promise<EstadoAcao>;

// Avaliação mensal do aluno: 1 a 5 estrelas sobre o desempenho no nível atual + comentário fundamentado.
export function FormAvaliacaoAluno({ acao, nota: notaInicial, comentario }: { acao: Acao; nota?: number | null; comentario?: string | null }) {
  const [estado, enviar, pendente] = useActionState(acao, undefined);
  const [nota, setNota] = useState(notaInicial ?? 0);
  return (
    <form action={enviar} className="mt-2 flex flex-col gap-2 text-sm">
      <input type="hidden" name="nota" value={nota} />
      <div className="flex items-center gap-3">
        <div className="flex gap-1" role="radiogroup" aria-label="Desempenho no nível atual">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={nota === n}
              aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
              onClick={() => setNota(n)}
              className={`text-3xl leading-none transition ${n <= nota ? "text-sol-400" : "text-areia-200 hover:text-sol-400/60"}`}
            >
              ★
            </button>
          ))}
        </div>
        {nota === 5 && <span className="rounded-full bg-verde-50 px-2 py-0.5 text-xs font-bold text-verde-700">Apto a subir de nível</span>}
      </div>
      <textarea
        name="comentario"
        rows={3}
        required
        minLength={20}
        maxLength={2000}
        defaultValue={comentario ?? ""}
        placeholder="Comentário fundamentado: o que ele já domina no nível, o que ainda falta treinar…"
        className={classeCampo}
      />
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <button disabled={pendente || nota === 0} className={`${classeBotao} w-fit disabled:opacity-50`}>
        {pendente ? "Salvando…" : notaInicial ? "Atualizar avaliação" : "Salvar avaliação"}
      </button>
    </form>
  );
}
