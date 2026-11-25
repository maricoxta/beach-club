"use client";

import { useState, useTransition } from "react";
import type { EstadoAcao } from "@/components/form-acao";

export function BotaoCancelar({ acao, rotulo }: { acao: () => Promise<EstadoAcao>; rotulo: string }) {
  const [pendente, iniciar] = useTransition();
  const [perguntando, setPerguntando] = useState(false);
  const [estado, setEstado] = useState<EstadoAcao>();
  if (estado?.ok) return <span className="text-xs font-semibold text-verde-700">{estado.ok}</span>;
  return (
    <div className="flex flex-col items-end gap-1">
      {perguntando ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pendente}
            onClick={() => iniciar(async () => setEstado(await acao()))}
            className="rounded-full bg-erro px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
          >
            {pendente ? "Cancelando…" : "Confirmar"}
          </button>
          <button type="button" onClick={() => setPerguntando(false)} className="text-xs font-semibold text-tinta-suave">
            Voltar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setPerguntando(true)} className="text-xs font-semibold text-erro hover:underline">
          {rotulo}
        </button>
      )}
      {estado?.erro && <span className="max-w-60 text-right text-xs font-semibold text-erro">{estado.erro}</span>}
    </div>
  );
}
