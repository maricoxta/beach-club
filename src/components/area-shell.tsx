import Link from "next/link";
import { Logo } from "@/components/logo";
import { rotuloPapel } from "@/lib/papel";
import type { Perfil } from "@/lib/sessao";

import { MenuArea, type ItemMenu } from "@/components/menu-area";

export type { ItemMenu };

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
    <div className="flex flex-1 flex-col bg-areia-50">
      <header className="relative border-b border-areia-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/">
            <Logo tamanho={40} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-bold text-verde-900">{perfil.nome}</p>
              <p className="text-xs font-semibold text-sol-500">{rotuloPapel[perfil.papel]}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-areia-200 font-display font-semibold text-verde-800">
              {iniciais}
            </span>
            <form action="/auth/sair" method="post">
              <button className="rounded-full border border-areia-300 px-4 py-1.5 text-sm font-semibold text-verde-800 transition hover:bg-verde-700 hover:border-verde-700 hover:text-white">
                Sair
              </button>
            </form>
          </div>
        </div>
        <MenuArea menu={menu} />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}

export function CartaoModulo({
  titulo,
  descricao,
  destaque,
  href,
}: {
  titulo: string;
  descricao: string;
  destaque?: string;
  href?: string;
}) {
  const conteudo = (
    <div className="flex h-full flex-col gap-2 rounded-3xl border border-areia-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-verde-600">
      {destaque && (
        <span className="w-fit rounded-full bg-sol-400/25 px-3 py-0.5 text-xs font-bold text-verde-900">
          {destaque}
        </span>
      )}
      <h2 className="font-display text-xl font-bold text-verde-900">{titulo}</h2>
      <p className="text-sm text-tinta-suave">{descricao}</p>
    </div>
  );
  return href ? <Link href={href}>{conteudo}</Link> : conteudo;
}

export function TituloArea({ ola, subtitulo }: { ola: string; subtitulo: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl font-semibold text-verde-900 sm:text-4xl">{ola}</h1>
      <p className="mt-1 text-tinta-suave">{subtitulo}</p>
    </div>
  );
}
