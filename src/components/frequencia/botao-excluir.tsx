"use client";

import { useFormStatus } from "react-dom";

function Botao({ classe }: { classe: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={classe}>
      {pending ? "Excluindo…" : "Excluir"}
    </button>
  );
}

// Excluir pede confirmação para evitar toque acidental no celular.
export function BotaoExcluir({
  acao,
  id,
  dia,
  classe,
}: {
  acao: (form: FormData) => Promise<void>;
  id: string;
  dia: string;
  classe: string;
}) {
  return (
    <form
      action={acao}
      onSubmit={(e) => {
        if (!window.confirm("Excluir este check-in? A foto também será apagada.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dia" value={dia} />
      <Botao classe={classe} />
    </form>
  );
}
