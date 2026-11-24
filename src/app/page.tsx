import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { marca } from "@/lib/marca";
import { rotaDoPapel } from "@/lib/papel";
import { getSessao } from "@/lib/sessao";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export default async function Home() {
  const { user, perfil } = await getSessao();
  if (user) redirect(perfil ? rotaDoPapel(perfil.papel) : "/sem-acesso");

  return (
    <main className="flex flex-1 flex-col">
      <section className="relative flex flex-1 flex-col overflow-hidden bg-white">
        <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Logo />
          <Link
            href="/login"
            className="rounded-full border-2 border-verde-700 px-5 py-2 text-sm font-bold text-verde-700 transition hover:bg-verde-700 hover:text-white"
          >
            Entrar
          </Link>
        </header>
        <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-32 pt-6 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-6">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-sol-500">
              <span className="h-2.5 w-2.5 rounded-full bg-sol-400" />
              Beach tênis · Vôlei de praia
            </p>
            <h1 className="max-w-2xl font-display text-5xl font-semibold leading-[1.05] text-verde-900 sm:text-6xl">
              Sua agenda de quadra, sem sair da areia.
            </h1>
            <p className="max-w-xl text-lg text-tinta-suave">
              {marca.slogan} Aulas, turmas, planos e locação de quadras em um só lugar.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-full bg-verde-700 px-7 py-3 font-bold text-white shadow-lg shadow-verde-700/20 transition hover:bg-verde-800"
              >
                Acessar minha conta
              </Link>
              <Link
                href="/login?modo=cadastro"
                className="rounded-full bg-areia-100 px-7 py-3 font-bold text-verde-900 transition hover:bg-areia-200"
              >
                Quero ser aluno
              </Link>
            </div>
          </div>
          <div className="relative mx-auto hidden aspect-square w-full max-w-sm lg:block">
            <div className="absolute inset-6 rounded-full bg-areia-50" />
            <Image src="/logo.png" alt={marca.nome} fill sizes="384px" className="object-contain p-4" priority />
          </div>
        </div>
        <div className="duna absolute bottom-0 h-24 w-full" />
      </section>
      <section className="bg-areia-200/60">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-14 pt-6 sm:grid-cols-3 sm:px-6">
          {[
            { t: "Recepção", d: "Turmas, matrículas, mensalidades e locação de quadras." },
            { t: "Professores", d: "Sua agenda do dia e a chamada de cada turma." },
            { t: "Alunos", d: "Suas aulas, seu plano e seus pagamentos." },
          ].map((c) => (
            <div key={c.t} className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="font-display text-xl font-semibold text-verde-800">{c.t}</h2>
              <p className="mt-2 text-tinta-suave">{c.d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
