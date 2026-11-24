"use client";

import { Aviso, classeBotaoSecundario } from "@/components/agenda/ui";

export default function ErroAgenda({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Aviso tipo="erro">{error.message || "Algo deu errado."}</Aviso>
      <button onClick={reset} className={classeBotaoSecundario}>
        Tentar de novo
      </button>
    </div>
  );
}
