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
      <section className="relative flex flex-1 flex-col overflow-hidden bg-mar-900 text-areia-50">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sol-400/90 blur-[2px]" />
        <div className="absolute -right-10 top-40 h-40 w-40 rounded-full bg-coral-500/80" />
        <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
          <Logo claro />
          <Link
            href="/login"
            className="rounded-full bg-areia-50 px-5 py-2 text-sm font-bold text-mar-900 transition hover:bg-sol-400"
          >
            Entrar
          </Link>
        </header>
        <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-4 pb-24 pt-10 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-sol-400">
            Beach tênis · Vôlei de praia
          </p>
          <h1 className="max-w-2xl font-display text-5xl font-extrabold leading-[1.05] sm:text-7xl">
            Sua agenda de quadra, sem sair da areia.
          </h1>
          <p className="max-w-xl text-lg text-areia-100/90">{marca.slogan} Aulas, turmas, planos e
            locação de quadras em um só lugar.</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-coral-500 px-7 py-3 font-bold text-white shadow-lg shadow-coral-600/30 transition hover:bg-coral-600"
            >
              Acessar minha conta
            </Link>
            <Link
              href="/login?modo=cadastro"
              className="rounded-full border-2 border-areia-50/40 px-7 py-3 font-bold transition hover:border-areia-50"
            >
              Quero ser aluno
            </Link>
          </div>
        </div>
        <div className="ondas absolute bottom-0 h-3 w-full" />
      </section>
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-12 sm:grid-cols-3 sm:px-6">
        {[
          { t: "Recepção", d: "Turmas, matrículas, mensalidades e locação de quadras." },
          { t: "Professores", d: "Sua agenda do dia e a chamada de cada turma." },
          { t: "Alunos", d: "Suas aulas, seu plano e seus pagamentos." },
        ].map((c) => (
          <div key={c.t} className="rounded-3xl bg-areia-100 p-6">
            <h2 className="font-display text-xl font-bold text-mar-900">{c.t}</h2>
            <p className="mt-2 text-tinta-suave">{c.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
