"use client";

import { useActionState } from "react";
import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";
import { DIAS_SEMANA } from "@/lib/agenda/datas";
import type { Opcao } from "@/lib/agenda/tipos";
import { Aviso, classeBotao, classeCampo } from "@/components/agenda/ui";

export type ValoresTurma = {
  nome: string;
  modalidade_id: string;
  nivel_id: string;
  professor_id: string;
  quadra_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  vagas: number;
};

function Selecao({ nome, rotulo, opcoes, valor }: { nome: string; rotulo: string; opcoes: Opcao[]; valor: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {rotulo}
      <select name={nome} defaultValue={valor} required className={classeCampo}>
        <option value="" disabled>
          Selecione
        </option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FormTurma({
  acao,
  valores,
  opcoes,
}: {
  acao: (estado: EstadoAcao, form: FormData) => Promise<EstadoAcao>;
  valores?: ValoresTurma;
  opcoes: { modalidades: Opcao[]; niveis: Opcao[]; quadras: Opcao[]; professores: Opcao[] };
}) {
  const [estado, enviar, pendente] = useActionState(acao, undefined);
  const v = valores;

  return (
    <form action={enviar} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
        Nome da turma
        <input name="nome" required defaultValue={v?.nome} placeholder="Ex.: Beach Tênis Iniciante Seg 18h" className={classeCampo} />
      </label>
      <Selecao nome="modalidade_id" rotulo="Modalidade" opcoes={opcoes.modalidades} valor={v?.modalidade_id ?? ""} />
      <Selecao nome="nivel_id" rotulo="Nível" opcoes={opcoes.niveis} valor={v?.nivel_id ?? ""} />
      <Selecao nome="professor_id" rotulo="Professor(a)" opcoes={opcoes.professores} valor={v?.professor_id ?? ""} />
      <Selecao nome="quadra_id" rotulo="Quadra" opcoes={opcoes.quadras} valor={v?.quadra_id ?? ""} />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Dia da semana
        <select name="dia_semana" defaultValue={v?.dia_semana ?? ""} required className={classeCampo}>
          <option value="" disabled>
            Selecione
          </option>
          {Object.entries(DIAS_SEMANA).map(([n, d]) => (
            <option key={n} value={n}>
              {d.longo}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Vagas
        <input name="vagas" type="number" min={1} max={99} required defaultValue={v?.vagas ?? 8} className={classeCampo} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Início
        <input name="hora_inicio" type="time" step={900} min="05:00" max="22:00" required defaultValue={v?.hora_inicio?.slice(0, 5)} className={classeCampo} />
        <span className="text-xs font-normal text-tinta-suave">Todas as aulas têm 1 hora.</span>
      </label>

      <div className="flex flex-col gap-3 sm:col-span-2">
        {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
        <button disabled={pendente} className={`${classeBotao} w-fit`}>
          {pendente ? "Salvando…" : v ? "Salvar alterações" : "Criar turma"}
        </button>
      </div>
    </form>
  );
}
