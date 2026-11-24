import type { Metadata } from "next";
import Image from "next/image";
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
    <main className="grid flex-1 bg-white lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-areia-50 p-10 lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="relative z-10">
          <Logo />
        </Link>
        <div className="relative z-10 mx-auto aspect-square w-72">
          <Image src="/logo.png" alt="" fill sizes="288px" className="object-contain" priority />
        </div>
        <blockquote className="relative z-10 max-w-md pb-6 font-display text-4xl font-semibold leading-tight text-verde-900">
          Bola no alto, pé na areia e a agenda em dia.
        </blockquote>
        <div className="duna absolute bottom-0 left-0 h-28 w-full" />
      </aside>

      <section className="flex flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="font-display text-3xl font-semibold text-verde-900">
            {cadastro ? "Crie sua conta" : "Bem-vindo de volta"}
          </h1>
          <p className="mb-8 mt-2 text-tinta-suave">
            {cadastro
              ? "Cadastre-se como aluno. Professores e equipe recebem acesso pela recepção."
              : "Entre para ver sua área no clube."}
          </p>
          {erro === "link" && (
            <p className="mb-4 rounded-2xl bg-erro/10 px-4 py-3 text-sm font-semibold text-erro">
              O link de confirmação expirou ou é inválido. Tente entrar ou peça um novo cadastro.
            </p>
          )}
          <FormLogin key={cadastro ? "c" : "e"} modo={cadastro ? "cadastro" : "entrar"} />
        </div>
      </section>
    </main>
  );
}
