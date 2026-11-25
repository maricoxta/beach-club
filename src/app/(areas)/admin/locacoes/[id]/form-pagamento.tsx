"use client";

import { FormAcao, type Acao } from "@/components/form-acao";
import { Campo, classeCampo } from "@/components/ui";
import { FORMAS_PAGAMENTO, rotuloForma } from "@/lib/locacoes/regras";

export function FormPagamento({ acao, restante }: { acao: Acao; restante: number }) {
  return (
    <FormAcao acao={acao} rotulo="Registrar pagamento" limparAoSalvar className="grid gap-3 sm:grid-cols-2">
      <Campo rotulo="Valor (R$)">
        <input
          name="valor"
          inputMode="decimal"
          required
          defaultValue={restante > 0 ? restante.toFixed(2).replace(".", ",") : ""}
          className={classeCampo}
        />
      </Campo>
      <Campo rotulo="Forma">
        <select name="forma" defaultValue="pix" className={classeCampo}>
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f} value={f}>
              {rotuloForma[f]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Observação" className="sm:col-span-2">
        <input name="observacao" placeholder="Opcional" className={classeCampo} />
      </Campo>
    </FormAcao>
  );
}
