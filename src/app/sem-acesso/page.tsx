import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { rotaDoPapel } from "@/lib/papel";
import { getSessao } from "@/lib/sessao";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export const metadata: Metadata = { title: "Acesso pendente" };

export default async function SemAcessoPage() {
  const { user, perfil } = await getSessao();
  if (!user) redirect("/login");
  if (perfil?.ativo) redirect(rotaDoPapel(perfil.papel));

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <h1 className="font-display text-3xl font-extrabold text-mar-900">Seu acesso ainda não foi liberado</h1>
      <p className="max-w-md text-tinta-suave">
        {perfil
          ? "Seu cadastro está inativo. Fale com a recepção do clube para reativá-lo."
          : `A conta ${user.email} não tem cadastro no clube. Fale com a recepção para liberar seu acesso.`}
      </p>
      <form action="/auth/sair" method="post">
        <button className="rounded-full bg-mar-900 px-6 py-3 font-bold text-areia-50 transition hover:bg-mar-600">
          Sair e usar outra conta
        </button>
      </form>
    </main>
  );
}
