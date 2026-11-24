import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getSessao } from "@/lib/sessao";
import { FormLogin } from "./form-login";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { user } = await getSessao();
  if (user) redirect("/");

  const { modo, erro } = await searchParams;
  const cadastro = modo === "cadastro";

  return (
    <main className="grid flex-1 lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-mar-900 p-10 text-areia-50 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sol-400" />
        <div className="absolute right-40 top-64 h-24 w-24 rounded-full bg-coral-500" />
        <Link href="/" className="relative">
          <Logo claro />
        </Link>
        <blockquote className="relative max-w-md font-display text-4xl font-extrabold leading-tight">
          Bola no alto, pé na areia e a agenda em dia.
        </blockquote>
      </aside>

      <section className="flex flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="font-display text-3xl font-extrabold text-mar-900">
            {cadastro ? "Crie sua conta" : "Bem-vindo de volta"}
          </h1>
          <p className="mb-8 mt-2 text-tinta-suave">
            {cadastro
              ? "Cadastre-se como aluno. Professores e equipe recebem acesso pela recepção."
              : "Entre para ver sua área no clube."}
          </p>
          {erro === "link" && (
            <p className="mb-4 rounded-2xl bg-coral-500/10 px-4 py-3 text-sm font-semibold text-coral-600">
              O link de confirmação expirou ou é inválido. Tente entrar ou peça um novo cadastro.
            </p>
          )}
          <FormLogin key={cadastro ? "c" : "e"} modo={cadastro ? "cadastro" : "entrar"} />
        </div>
      </section>
    </main>
  );
}
