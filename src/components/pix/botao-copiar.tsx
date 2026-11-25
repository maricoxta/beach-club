"use client";

import { useState } from "react";
import { classeBotao } from "@/components/ui";

export function BotaoCopiar({ texto, rotulo = "Copiar código Pix" }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Navegadores sem permissão de área de transferência: seleciona o campo para copiar na mão.
      const campo = document.getElementById(`pix-${texto.slice(-8)}`) as HTMLTextAreaElement | null;
      campo?.select();
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }
  return (
    <button type="button" onClick={copiar} className={classeBotao}>
      {copiado ? "Copiado!" : rotulo}
    </button>
  );
}
