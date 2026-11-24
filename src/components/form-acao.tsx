"use client";

import { startTransition, useActionState, useRef } from "react";
import { Alerta, classeBotao } from "@/components/ui";

export type EstadoAcao = { erro?: string; ok?: string } | undefined;
export type Acao = (estado: EstadoAcao, form: FormData) => Promise<EstadoAcao>;

// Formulário ligado a uma Server Action, com mensagem de erro/sucesso e botão com estado pendente.
export function FormAcao({
  acao,
  rotulo,
  rotuloPendente = "Salvando…",
  classeBotaoEnviar = classeBotao,
  className = "flex flex-col gap-4",
  limparAoSalvar = false,
  children,
}: {
  acao: Acao;
  rotulo: string;
  rotuloPendente?: string;
  classeBotaoEnviar?: string;
  className?: string;
  limparAoSalvar?: boolean;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [estado, despachar, pendente] = useActionState<EstadoAcao, FormData>(async (anterior, form) => {
    const resultado = await acao(anterior, form);
    if (resultado?.ok && limparAoSalvar) ref.current?.reset();
    return resultado;
  }, undefined);

  // Envio manual: o reset automático do React 19 apagaria o que foi digitado quando há erro.
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => despachar(form));
  }

  return (
    <form ref={ref} onSubmit={enviar} className={className}>
      {children}
      {estado?.erro && <Alerta tipo="erro">{estado.erro}</Alerta>}
      {estado?.ok && <Alerta tipo="ok">{estado.ok}</Alerta>}
      <div>
        <button type="submit" disabled={pendente} className={classeBotaoEnviar}>
          {pendente ? rotuloPendente : rotulo}
        </button>
      </div>
    </form>
  );
}
