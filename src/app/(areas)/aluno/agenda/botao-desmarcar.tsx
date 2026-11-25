"use client";

import { useState, useTransition } from "react";
import { alternarCheckin, alternarDesmarcacao, cancelarReserva, reservarAula } from "./acoes";

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

function BotaoAcao({ rotulo, confirmar, acao, estilo }: { rotulo: string; confirmar?: string; acao: () => Promise<{ erro?: string; ok?: string } | undefined>; estilo: string }) {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ erro?: string; ok?: string }>();
  return (
    <div className="flex flex-col gap-1">
      <button
        disabled={pendente || !!msg?.ok}
        onClick={() =>
          iniciar(async () => {
            if (confirmar && !confirm(confirmar)) return;
            setMsg(await acao());
          })
        }
        className={`rounded-full px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${estilo}`}
      >
        {pendente ? "Aguarde…" : rotulo}
      </button>
      {msg?.erro && <p className="text-xs font-semibold text-erro">{msg.erro}</p>}
      {msg?.ok && <p className="text-xs font-semibold text-verde-700">{msg.ok}</p>}
    </div>
  );
}

export function BotaoCancelarReserva({ aulaId }: { aulaId: string }) {
  return (
    <BotaoAcao
      rotulo="Cancelar reserva"
      confirmar="Cancelar esta reserva? A vaga volta a ficar livre e você recupera o crédito."
      acao={() => cancelarReserva(aulaId)}
      estilo="border border-erro/40 bg-white text-erro hover:bg-erro hover:text-white"
    />
  );
}

export function BotaoReservar({ aulaId, rotulo = "Reservar" }: { aulaId: string; rotulo?: string }) {
  return (
    <BotaoAcao rotulo={rotulo} acao={() => reservarAula(aulaId)} estilo="bg-verde-700 text-white hover:bg-verde-800" />
  );
}

export function BotaoCheckin({ aulaId, feito, prazo }: { aulaId: string; feito: boolean; prazo: string }) {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ erro?: string; ok?: string }>();
  return (
    <div className="flex flex-col gap-1">
      <button
        disabled={pendente}
        onClick={() => iniciar(async () => setMsg(await alternarCheckin(aulaId, !feito)))}
        className={`rounded-full px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${
          feito ? "bg-verde-50 text-verde-700 hover:bg-verde-100" : "bg-sol-400 text-verde-900 hover:bg-sol-500"
        }`}
      >
        {pendente ? "Aguarde…" : feito ? "Check-in feito ✓ (desfazer)" : "Fazer check-in"}
      </button>
      {!feito && <p className="text-center text-[11px] text-tinta-suave">Até {prazo}</p>}
      {msg?.erro && <p className="text-xs font-semibold text-erro">{msg.erro}</p>}
    </div>
  );
}
