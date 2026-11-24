"use client";

import { useState, useTransition } from "react";
import { alternarDesmarcacao } from "./acoes";

export function BotaoDesmarcar({ aulaId, desmarcada, prazo }: { aulaId: string; desmarcada: boolean; prazo: string }) {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ erro?: string; ok?: string }>();
  return (
    <div className="flex flex-col gap-1">
      <button
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            if (!desmarcada && !confirm("Desmarcar esta aula? A vaga fica livre para outro aluno.")) return;
            setMsg(await alternarDesmarcacao(aulaId, !desmarcada));
          })
        }
        className={`rounded-full px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${
          desmarcada
            ? "bg-verde-700 text-white hover:bg-verde-800"
            : "border border-erro/40 bg-white text-erro hover:bg-erro hover:text-white"
        }`}
      >
        {pendente ? "Aguarde…" : desmarcada ? "Remarcar aula" : "Desmarcar aula"}
      </button>
      <p className="text-center text-[11px] text-tinta-suave">Até {prazo}</p>
      {msg?.erro && <p className="text-xs font-semibold text-erro">{msg.erro}</p>}
      {msg?.ok && <p className="text-xs font-semibold text-verde-700">{msg.ok}</p>}
    </div>
  );
}
