import { Campo, classeCampo } from "@/components/ui";

export type Plano = {
  id: string;
  nome: string;
  aulas_por_semana: number;
  valor_mensal: number;
  modalidade_id: string | null;
  ativo: boolean;
};
export type Modalidade = { id: string; nome: string };

// Campos do formulário de plano (usados no cadastro e na edição).
export function CamposPlano({ plano, modalidades }: { plano?: Plano; modalidades: Modalidade[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {plano && <input type="hidden" name="id" value={plano.id} />}
      <Campo rotulo="Nome" className="sm:col-span-2">
        <input name="nome" required defaultValue={plano?.nome} placeholder="Ex.: Beach tênis 2x" className={classeCampo} />
      </Campo>
      <Campo rotulo="Aulas por semana">
        <select name="aulas_por_semana" defaultValue={plano?.aulas_por_semana ?? 1} className={classeCampo}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}x por semana
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Valor mensal (R$)">
        <input
          name="valor_mensal"
          required
          inputMode="decimal"
          defaultValue={plano ? String(plano.valor_mensal).replace(".", ",") : ""}
          placeholder="250,00"
          className={classeCampo}
        />
      </Campo>
      <Campo rotulo="Modalidade" dica="Em branco: vale para qualquer modalidade.">
        <select name="modalidade_id" defaultValue={plano?.modalidade_id ?? ""} className={classeCampo}>
          <option value="">Qualquer modalidade</option>
          {modalidades.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </Campo>
      <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold text-verde-900">
        <input type="checkbox" name="ativo" defaultChecked={plano?.ativo ?? true} className="h-4 w-4 accent-verde-700" />
        Disponível para novas matrículas
      </label>
    </div>
  );
}
