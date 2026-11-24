import Link from "next/link";
import { Logo } from "@/components/logo";
import { rotuloPapel } from "@/lib/papel";
import type { Perfil } from "@/lib/sessao";

// Itens sem href são módulos ainda não implementados.
export type ItemMenu = { rotulo: string; href?: string };

export function AreaShell({
  perfil,
  menu,
  children,
}: {
  perfil: Perfil;
  menu: ItemMenu[];
  children: React.ReactNode;
}) {
  const iniciais = perfil.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex flex-1 flex-col">
      <header className="relative bg-mar-900 text-areia-50">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/">
            <Logo claro />
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-bold">{perfil.nome}</p>
              <p className="text-xs text-sol-400">{rotuloPapel[perfil.papel]}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-coral-500 font-display font-bold">
              {iniciais}
            </span>
            <form action="/auth/sair" method="post">
              <button className="rounded-full border border-areia-50/30 px-4 py-1.5 text-sm font-semibold transition hover:bg-areia-50 hover:text-mar-900">
                Sair
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 pb-4 sm:px-6">
          {menu.map((item) =>
            item.href ? (
              <Link
                key={item.rotulo}
                href={item.href}
                className="whitespace-nowrap rounded-full bg-mar-500 px-4 py-1.5 text-sm font-semibold text-white"
              >
                {item.rotulo}
              </Link>
            ) : (
              <span
                key={item.rotulo}
                title="Em breve"
                className="cursor-default whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold text-areia-100/50"
              >
                {item.rotulo}
              </span>
            ),
          )}
        </nav>
        <div className="ondas absolute bottom-0 h-3 w-full translate-y-[1px]" />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

export function CartaoModulo({
  titulo,
  descricao,
  destaque,
}: {
  titulo: string;
  descricao: string;
  destaque?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-3xl border-2 border-areia-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-mar-500">
      {destaque && (
        <span className="w-fit rounded-full bg-sol-400/30 px-3 py-0.5 text-xs font-bold text-mar-900">
          {destaque}
        </span>
      )}
      <h2 className="font-display text-xl font-bold text-mar-900">{titulo}</h2>
      <p className="text-sm text-tinta-suave">{descricao}</p>
    </div>
  );
}

export function TituloArea({ ola, subtitulo }: { ola: string; subtitulo: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl font-extrabold text-mar-900 sm:text-4xl">{ola}</h1>
      <p className="mt-1 text-tinta-suave">{subtitulo}</p>
    </div>
  );
}
