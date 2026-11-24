"use client";

import { useActionState } from "react";
import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";
import { rotuloStatusAula, STATUS_AULA, type Opcao, type StatusAula } from "@/lib/agenda/tipos";
import { Aviso, classeBotao, classeCampo } from "@/components/agenda/ui";

type Acao = (estado: EstadoAcao, form: FormData) => Promise<EstadoAcao>;

export function FormAula({
  acao,
  aula,
  professores,
  quadras,
}: {
  acao: Acao;
  aula: { status: StatusAula; professor_id: string; quadra_id: string; observacao: string };
  professores: Opcao[];
  quadras: Opcao[];
}) {
  const [estado, enviar, pendente] = useActionState(acao, undefined);
  return (
    <form action={enviar} className="flex flex-col gap-3 text-sm">
      <label className="flex flex-col gap-1 font-semibold">
        Status
        <select name="status" defaultValue={aula.status} className={classeCampo}>
          {STATUS_AULA.map((s) => (
            <option key={s} value={s}>
              {rotuloStatusAula[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Professor desta aula
        <select name="professor_id" defaultValue={aula.professor_id} className={classeCampo}>
          {professores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Quadra desta aula
        <select name="quadra_id" defaultValue={aula.quadra_id} className={classeCampo}>
          {quadras.map((q) => (
            <option key={q.id} value={q.id}>
              {q.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Observação
        <textarea name="observacao" defaultValue={aula.observacao} rows={2} className={classeCampo} placeholder="Ex.: cancelada por chuva" />
      </label>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <button disabled={pendente} className={classeBotao}>
        {pendente ? "Salvando…" : "Salvar aula"}
      </button>
    </form>
  );
}

export function FormAvulso({ acao, alunos }: { acao: Acao; alunos: Opcao[] }) {
  const [estado, enviar, pendente] = useActionState(acao, undefined);
  if (alunos.length === 0) return <p className="text-sm text-tinta-suave">Nenhum outro aluno ativo cadastrado.</p>;
  return (
    <form action={enviar} className="flex flex-col gap-3 text-sm">
      <select name="aluno_id" required defaultValue="" className={classeCampo}>
        <option value="" disabled>
          Escolha o aluno
        </option>
        {alunos.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </select>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <button disabled={pendente} className={classeBotao}>
        {pendente ? "Adicionando…" : "Adicionar à chamada"}
      </button>
    </form>
  );
}
