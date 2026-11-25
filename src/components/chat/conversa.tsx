"use client";

import { Fragment, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enviarMensagem, marcarConversaLida } from "@/lib/chat-acoes";
import { LIMITE_TEXTO, diaDe, horaDe, rotuloDia, type Mensagem } from "@/lib/chat";

type Props = {
  mensagens: Mensagem[];
  // "aluno": balões do aluno à direita. "equipe": balões da recepção à direita.
  lado: "aluno" | "equipe";
  // Conversa aberta pela equipe (obrigatório para a equipe enviar).
  alunoId?: string;
  nomeOutroLado: string;
  temNaoLidas: boolean;
  vazio: React.ReactNode;
};

type Exibida = Mensagem & { enviando?: boolean };

export function Conversa({ mensagens, lado, alunoId, nomeOutroLado, temNaoLidas, vazio }: Props) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  // Mensagens que este navegador enviou e o servidor ainda não devolveu no refresh.
  const [locais, setLocais] = useState<Mensagem[]>([]);
  const ids = new Set(mensagens.map((m) => m.id));
  const base = [...mensagens, ...locais.filter((m) => !ids.has(m.id))];
  const [exibidas, adicionarOtimista] = useOptimistic<Exibida[], Exibida>(base, (atual, nova) => [...atual, nova]);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  // Rola para a última mensagem quando a lista muda.
  const ultima = exibidas.at(-1)?.id;
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [ultima, exibidas.length]);

  // Abriu a conversa com mensagens novas: marca como lida e atualiza o contador do menu.
  useEffect(() => {
    if (!temNaoLidas) return;
    void marcarConversaLida(alunoId).then(() => router.refresh());
  }, [temNaoLidas, alunoId, router, ultima]);

  function enviar() {
    const limpo = texto.trim();
    if (!limpo || pendente) return;
    setErro(null);
    setTexto("");
    startTransition(async () => {
      adicionarOtimista({
        id: -Date.now(),
        aluno_id: alunoId ?? "",
        da_equipe: lado === "equipe",
        texto: limpo,
        created_at: new Date().toISOString(),
        enviando: true,
      });
      const r = await enviarMensagem(limpo, alunoId);
      if (!r.ok) {
        setErro(r.erro);
        setTexto(limpo);
        return;
      }
      setLocais((atual) => [...atual, r.mensagem]);
      router.refresh();
    });
    campo.current?.focus();
  }

  return (
    <div className="flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-3xl border border-areia-200 bg-white shadow-sm">
      <div className="flex-1 overflow-y-auto bg-areia-50/60 px-3 py-4 sm:px-5">
        {exibidas.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-tinta-suave">{vazio}</div>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {exibidas.map((m, i) => {
              const meu = lado === "equipe" ? m.da_equipe : !m.da_equipe;
              const novoDia = i === 0 || diaDe(exibidas[i - 1].created_at) !== diaDe(m.created_at);
              return (
                <Fragment key={m.id}>
                  {novoDia && (
                    <li className="my-2 self-center rounded-full bg-areia-100 px-3 py-0.5 text-xs font-semibold first-letter:uppercase text-tinta-suave">
                      {rotuloDia(m.created_at)}
                    </li>
                  )}
                  <li className={`flex max-w-[85%] flex-col sm:max-w-[70%] ${meu ? "self-end items-end" : "self-start items-start"}`}>
                    <div
                      className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                        meu ? "rounded-br-md bg-verde-700 text-white" : "rounded-bl-md border border-areia-200 bg-white text-tinta"
                      } ${m.enviando ? "opacity-70" : ""}`}
                    >
                      {m.texto}
                    </div>
                    <span className="mt-0.5 px-1 text-[11px] text-tinta-suave">
                      {!meu && <span className="font-semibold">{nomeOutroLado} · </span>}
                      {m.enviando ? "enviando…" : horaDe(m.created_at)}
                    </span>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        )}
        <div ref={fim} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-areia-200 bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <label htmlFor="texto-mensagem" className="sr-only">
          Mensagem
        </label>
        <textarea
          id="texto-mensagem"
          ref={campo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              enviar();
            }
          }}
          rows={1}
          maxLength={LIMITE_TEXTO}
          placeholder="Escreva sua mensagem…"
          className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border-2 border-areia-200 bg-white px-3 py-2.5 text-sm text-tinta outline-none transition [field-sizing:content] focus:border-verde-600"
        />
        <button
          type="submit"
          disabled={!texto.trim() || pendente}
          className="h-11 shrink-0 rounded-full bg-verde-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-verde-800 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
      {erro && (
        <p role="alert" className="border-t border-erro/20 bg-erro/10 px-4 py-2 text-sm font-semibold text-erro">
          {erro}
        </p>
      )}
    </div>
  );
}
