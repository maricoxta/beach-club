"use client";

import { useState } from "react";
import { FormAcao, type Acao } from "@/components/form-acao";
import { Campo, classeCampo } from "@/components/ui";
import { moeda } from "@/lib/formato";

export function FormPedido({
  acao,
  quadraId,
  data,
  hora,
  maxHoras,
  valorHora,
}: {
  acao: Acao;
  quadraId: string;
  data: string;
  hora: number;
  maxHoras: number;
  valorHora: number;
}) {
  const [horas, setHoras] = useState(1);
  return (
    <FormAcao acao={acao} rotulo="Enviar pedido" rotuloPendente="Enviando…">
      <input type="hidden" name="quadra_id" value={quadraId} />
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="hora" value={hora} />
      <Campo rotulo="Duração" dica={`Das ${hora}h às ${hora + horas}h.`}>
        <select name="horas" value={horas} onChange={(e) => setHoras(Number(e.target.value))} className={classeCampo}>
          {Array.from({ length: maxHoras }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} hora{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </Campo>
      <div className="rounded-2xl bg-areia-50 px-4 py-3">
        <span className="text-xs font-semibold text-tinta-suave">Valor estimado</span>
        <p className="font-display text-2xl font-bold text-verde-900">{moeda(valorHora * horas)}</p>
        <span className="text-xs text-tinta-suave">Pago na recepção ou como combinar com o clube.</span>
      </div>
      <Campo rotulo="Recado para a recepção">
        <textarea name="observacao" rows={2} maxLength={300} placeholder="Opcional (ex.: vou levar 3 amigos)" className={classeCampo} />
      </Campo>
    </FormAcao>
  );
}
