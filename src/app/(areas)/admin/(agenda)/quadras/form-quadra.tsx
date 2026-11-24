"use client";

import { useActionState } from "react";
import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";
import { Aviso, classeBotao, classeCampo } from "@/components/agenda/ui";

export type Quadra = { id: string; nome: string; descricao: string | null; valor_hora: number; ativo: boolean };

export function FormQuadra({ acao, quadra }: { acao: (e: EstadoAcao, f: FormData) => Promise<EstadoAcao>; quadra?: Quadra }) {
  const [estado, enviar, pendente] = useActionState(acao, undefined);
  return (
    <form action={enviar} className="grid gap-3 text-sm sm:grid-cols-[1fr_140px]">
      <label className="flex flex-col gap-1 font-semibold">
        Nome
        <input name="nome" required defaultValue={quadra?.nome} placeholder="Ex.: Quadra 1" className={classeCampo} />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Valor/hora (R$)
        <input name="valor_hora" inputMode="decimal" defaultValue={quadra?.valor_hora ?? ""} placeholder="80" className={classeCampo} />
      </label>
      <label className="flex flex-col gap-1 font-semibold sm:col-span-2">
        Descrição
        <input name="descricao" defaultValue={quadra?.descricao ?? ""} placeholder="Opcional" className={classeCampo} />
      </label>
      {quadra && (
        <label className="flex items-center gap-2 text-tinta-suave sm:col-span-2">
          <input type="hidden" name="ativo" value="0" />
          <input type="checkbox" name="ativo" value="1" defaultChecked={quadra.ativo} className="accent-verde-700" />
          Quadra ativa
        </label>
      )}
      <div className="flex flex-col gap-2 sm:col-span-2">
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
        <button disabled={pendente} className={`${classeBotao} w-fit`}>
          {pendente ? "Salvando…" : quadra ? "Salvar" : "Cadastrar quadra"}
        </button>
      </div>
    </form>
  );
}
