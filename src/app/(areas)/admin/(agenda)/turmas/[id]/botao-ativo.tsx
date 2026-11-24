"use client";

import { useState, useTransition } from "react";
import { classeBotaoSecundario } from "@/components/agenda/ui";
import { alternarTurma } from "../../acoes";

export function BotaoAtivo({ id, ativo }: { id: string; ativo: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string>();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className={classeBotaoSecundario}
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            if (ativo && !confirm("Desativar a turma? Ela deixa de gerar aulas novas.")) return;
            const r = await alternarTurma(id, !ativo);
            setErro(r?.erro);
          })
        }
      >
        {pendente ? "Aguarde…" : ativo ? "Desativar turma" : "Reativar turma"}
      </button>
      {erro && <span className="text-xs font-semibold text-erro">{erro}</span>}
    </div>
  );
}
