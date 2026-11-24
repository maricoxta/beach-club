"use client";

import { useActionState, useState } from "react";
import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";
import { rotuloPresenca, STATUS_PRESENCA, type ItemChamada, type StatusPresenca } from "@/lib/agenda/tipos";
import { Aviso, classeBotao, classeBotaoSecundario } from "./ui";

const corOpcao: Record<StatusPresenca, string> = {
  presente: "peer-checked:bg-verde-700 peer-checked:text-white peer-checked:border-verde-700",
  falta: "peer-checked:bg-erro peer-checked:text-white peer-checked:border-erro",
  falta_justificada: "peer-checked:bg-sol-400 peer-checked:text-verde-900 peer-checked:border-sol-400",
};

const rotuloCurto: Record<StatusPresenca, string> = { presente: "Presente", falta: "Falta", falta_justificada: "Justificada" };

export function FormChamada({
  lista,
  acao,
  aulaAgendada,
}: {
  lista: ItemChamada[];
  acao: (estado: EstadoAcao, form: FormData) => Promise<EstadoAcao>;
  aulaAgendada: boolean;
}) {
  const [estado, enviar, pendente] = useActionState(acao, undefined);
  const [marcas, setMarcas] = useState<Record<string, StatusPresenca | "">>(() =>
    Object.fromEntries(lista.map((i) => [i.aluno_id, i.status ?? ""])),
  );

  const presentes = Object.values(marcas).filter((s) => s === "presente").length;
  const semMarcacao = Object.values(marcas).filter((s) => !s).length;

  function marcarTodos(status: StatusPresenca) {
    setMarcas(Object.fromEntries(lista.map((i) => [i.aluno_id, status])));
  }

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-tinta-suave">
          <strong className="text-verde-900">{presentes}</strong> presente(s) de {lista.length}
          {semMarcacao > 0 && <> · {semMarcacao} sem marcação</>}
        </p>
        <button type="button" className={classeBotaoSecundario} onClick={() => marcarTodos("presente")}>
          Todos presentes
        </button>
      </div>

      <ul className="flex flex-col divide-y divide-areia-100 rounded-3xl border border-areia-200 bg-white">
        {lista.map((item) => (
          <li key={item.aluno_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-semibold text-tinta">{item.nome}</p>
              {!item.matriculado && <p className="text-xs font-semibold text-sol-500">Reposição / avulso</p>}
              {item.observacao === "Desmarcada pelo aluno" && (
                <p className="text-xs font-semibold text-sol-500">Desmarcou pelo app</p>
              )}
            </div>
            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">Presença de {item.nome}</legend>
              <input type="hidden" name={`status:${item.aluno_id}`} value={marcas[item.aluno_id] ?? ""} />
              {STATUS_PRESENCA.map((s) => (
                <label key={s} className="cursor-pointer" title={rotuloPresenca[s]}>
                  <input
                    type="radio"
                    className="peer sr-only"
                    name={`radio:${item.aluno_id}`}
                    checked={marcas[item.aluno_id] === s}
                    onChange={() => setMarcas((m) => ({ ...m, [item.aluno_id]: s }))}
                  />
                  <span
                    className={`block rounded-full border border-areia-300 px-3 py-1.5 text-xs font-bold text-verde-800 transition peer-focus-visible:ring-2 peer-focus-visible:ring-verde-600 ${corOpcao[s]}`}
                  >
                    {rotuloCurto[s]}
                  </span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ul>

      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pendente} className={classeBotao}>
          {pendente ? "Salvando…" : "Salvar chamada"}
        </button>
        {aulaAgendada && (
          <label className="flex items-center gap-2 text-sm text-tinta-suave">
            <input type="checkbox" name="concluir" value="1" defaultChecked className="accent-verde-700" />
            Marcar a aula como realizada
          </label>
        )}
      </div>
    </form>
  );
}
