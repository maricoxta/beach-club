"use client";

import { useState, useTransition } from "react";
import type { EstadoAcao } from "@/components/form-acao";
import { Alerta, classeBotaoPerigo, classeBotaoSecundario } from "@/components/ui";

type AcaoSimples = () => Promise<EstadoAcao>;

// Confirmar reserva e cancelar (cancelar pede um segundo clique).
export function BotoesStatus({
  confirmar,
  cancelar,
  podeConfirmar,
  avisoCancelar,
}: {
  confirmar: AcaoSimples;
  cancelar: AcaoSimples;
  podeConfirmar: boolean;
  avisoCancelar?: string;
}) {
  const [pendente, iniciar] = useTransition();
  const [estado, setEstado] = useState<EstadoAcao>();
  const [perguntando, setPerguntando] = useState(false);
  const rodar = (acao: AcaoSimples) => iniciar(async () => setEstado(await acao()));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {podeConfirmar && (
          <button type="button" disabled={pendente} onClick={() => rodar(confirmar)} className={classeBotaoSecundario}>
            Marcar como confirmada
          </button>
        )}
        {perguntando ? (
          <>
            <button type="button" disabled={pendente} onClick={() => rodar(cancelar)} className={classeBotaoPerigo}>
              {pendente ? "Cancelando…" : "Sim, cancelar locação"}
            </button>
            <button type="button" disabled={pendente} onClick={() => setPerguntando(false)} className={classeBotaoSecundario}>
              Voltar
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setPerguntando(true)} className={classeBotaoPerigo}>
            Cancelar locação
          </button>
        )}
      </div>
      {perguntando && avisoCancelar && <p className="text-sm text-tinta-suave">{avisoCancelar}</p>}
      {estado?.erro && <Alerta tipo="erro">{estado.erro}</Alerta>}
      {estado?.ok && <Alerta tipo="ok">{estado.ok}</Alerta>}
    </div>
  );
}
