"use client";

import { useFormStatus } from "react-dom";
import { classeBotaoPerigo } from "@/components/ui";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={classeBotaoPerigo}>
      {pending ? "Excluindo…" : "Excluir parceiro"}
    </button>
  );
}

export function BotaoExcluirParceiro({ acao, nome }: { acao: () => Promise<void>; nome: string }) {
  return (
    <form
      action={acao}
      onSubmit={(e) => {
        if (!window.confirm(`Excluir ${nome}? Para só esconder dos alunos, desmarque "Publicar".`)) e.preventDefault();
      }}
    >
      <Botao />
    </form>
  );
}
