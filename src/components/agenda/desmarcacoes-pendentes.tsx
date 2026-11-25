"use client";

import { useState, useTransition } from "react";
import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";

type Decidir = (presencaId: string, liberar: boolean) => Promise<EstadoAcao>;

export function BotoesDecisao({ presencaId, decidir }: { presencaId: string; decidir: Decidir }) {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<EstadoAcao>();
  if (msg?.ok) return <p className="text-sm font-semibold text-verde-700">{msg.ok}</p>;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pendente}
          onClick={() => iniciar(async () => setMsg(await decidir(presencaId, true)))}
          className="rounded-full bg-verde-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-verde-800 disabled:opacity-60"
        >
          {pendente ? "Aguarde…" : "Liberar vaga"}
        </button>
        <button
          disabled={pendente}
          onClick={() => iniciar(async () => setMsg(await decidir(presencaId, false)))}
          className="rounded-full border border-areia-300 bg-white px-4 py-2 text-sm font-semibold text-verde-800 transition hover:border-verde-700 disabled:opacity-60"
        >
          Não liberar
        </button>
      </div>
      {msg?.erro && <p className="text-xs font-semibold text-erro">{msg.erro}</p>}
    </div>
  );
}
