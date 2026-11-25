"use client";

import { useActionState, useState } from "react";
import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";

type Acao = (estado: EstadoAcao, form: FormData) => Promise<EstadoAcao>;

// Estrelas de 1 a 5 + comentário opcional. A avaliação é anônima (o banco não guarda quem deu a nota).
export function FormAvaliarAula({ acao }: { acao: Acao }) {
  const [estado, enviar, pendente] = useActionState(acao, undefined);
  const [nota, setNota] = useState(0);
  if (estado?.ok) return <p className="text-sm font-semibold text-verde-700">{estado.ok}</p>;
  return (
    <form action={enviar} className="flex flex-col gap-2">
      <input type="hidden" name="nota" value={nota} />
      <div className="flex gap-1" role="radiogroup" aria-label="Nota da aula">
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
      <textarea
        name="comentario"
        rows={2}
        maxLength={1000}
        placeholder="Comentário (opcional)"
        className="w-full rounded-2xl border-2 border-areia-200 bg-white px-3 py-2 text-sm outline-none focus:border-verde-600"
      />
      {estado?.erro && <p className="text-xs font-semibold text-erro">{estado.erro}</p>}
      <button
        disabled={pendente || nota === 0}
        className="w-fit rounded-full bg-verde-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-verde-800 disabled:opacity-50"
      >
        {pendente ? "Enviando…" : "Enviar avaliação"}
      </button>
    </form>
  );
}
