"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cadastrar, entrar, type EstadoForm } from "./actions";

const campo =
  "w-full rounded-2xl border-2 border-areia-200 bg-white px-4 py-3 text-tinta outline-none transition placeholder:text-tinta-suave/60 focus:border-verde-600";

export function FormLogin({ modo }: { modo: "entrar" | "cadastro" }) {
  const cadastro = modo === "cadastro";
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(
    cadastro ? cadastrar : entrar,
    undefined,
  );

  return (
    <form action={acao} className="flex flex-col gap-4">
      {cadastro && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Nome completo
          <input name="nome" autoComplete="name" required className={campo} />
        </label>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        E-mail
        <input name="email" type="email" autoComplete="email" required className={campo} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Senha
        <input
          name="senha"
          type="password"
          autoComplete={cadastro ? "new-password" : "current-password"}
          minLength={cadastro ? 8 : undefined}
          required
          className={campo}
        />
      </label>

      {estado?.erro && (
        <p role="alert" className="rounded-2xl bg-erro/10 px-4 py-3 text-sm font-semibold text-erro">
          {estado.erro}
        </p>
      )}
      {estado?.aviso && (
        <p role="status" className="rounded-2xl bg-verde-50 px-4 py-3 text-sm font-semibold text-verde-700">
          {estado.aviso}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="mt-2 rounded-full bg-verde-700 px-6 py-3.5 font-bold text-white shadow-lg shadow-verde-700/20 transition hover:bg-verde-800 disabled:opacity-60"
      >
        {pendente ? "Aguarde…" : cadastro ? "Criar conta" : "Entrar"}
      </button>

      <p className="text-center text-sm text-tinta-suave">
        {cadastro ? "Já tem conta? " : "Ainda não é aluno? "}
        <Link
          href={cadastro ? "/login" : "/login?modo=cadastro"}
          className="font-bold text-verde-700 underline-offset-4 hover:underline"
        >
          {cadastro ? "Entrar" : "Criar conta"}
        </Link>
      </p>
    </form>
  );
}
