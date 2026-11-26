"use client";

import { useActionState } from "react";
import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";
import { PAPEIS, rotuloPapel, type Papel } from "@/lib/papel";

export function FormPapel({
  acao,
  papel,
  ativo,
  bloqueado,
  podeAdmin,
}: {
  acao: (e: EstadoAcao, f: FormData) => Promise<EstadoAcao>;
  papel: Papel;
  ativo: boolean;
  bloqueado: boolean;
  podeAdmin: boolean;
}) {
  const [estado, enviar, pendente] = useActionState(acao, undefined);
  if (bloqueado) return <span className="text-sm font-semibold text-sol-500">{rotuloPapel[papel]}</span>;
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-2 text-sm">
      <select
        name="papel"
        defaultValue={papel}
        className="rounded-full border-2 border-areia-200 bg-white px-3 py-1.5 outline-none focus:border-verde-600"
      >
        {PAPEIS.filter((p) => podeAdmin || (p !== "admin" && p !== "recepcao")).map((p) => (
          <option key={p} value={p}>
            {rotuloPapel[p]}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-tinta-suave">
        <input type="checkbox" name="ativo" value="1" defaultChecked={ativo} className="accent-verde-700" />
        Ativo
      </label>
      <button disabled={pendente} className="rounded-full border border-areia-300 px-3 py-1.5 font-semibold text-verde-800 hover:border-verde-700">
        {pendente ? "…" : "Salvar"}
      </button>
      {estado?.erro && <span className="w-full text-xs font-semibold text-erro">{estado.erro}</span>}
      {estado?.ok && <span className="w-full text-xs font-semibold text-verde-700">{estado.ok}</span>}
    </form>
  );
}
