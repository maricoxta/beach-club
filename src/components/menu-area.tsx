"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Itens sem href são módulos ainda não implementados.
export type ItemMenu = { rotulo: string; href?: string };

// A raiz da área (ex.: /admin) só fica ativa na própria página; as demais também nas subpáginas.
function ativo(pathname: string, href: string) {
  const raiz = href.split("/").filter(Boolean).length === 1;
  return raiz ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function MenuArea({ menu }: { menu: ItemMenu[] }) {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 pb-4 sm:px-6">
      {menu.map((item) =>
        item.href ? (
          <Link
            key={item.rotulo}
            href={item.href}
            aria-current={ativo(pathname, item.href) ? "page" : undefined}
            className={
              ativo(pathname, item.href)
                ? "whitespace-nowrap rounded-full bg-verde-700 px-4 py-1.5 text-sm font-semibold text-white"
                : "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold text-verde-800 transition hover:bg-verde-50"
            }
          >
            {item.rotulo}
          </Link>
        ) : (
          <span
            key={item.rotulo}
            title="Em breve"
            className="cursor-default whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold text-tinta-suave/50"
          >
            {item.rotulo}
          </span>
        ),
      )}
    </nav>
  );
}
