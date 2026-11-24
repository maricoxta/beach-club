"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ItemSubnav = { href: string; rotulo: string };

// Abas internas de um módulo (ex.: Agenda | Turmas | Quadras | Equipe).
export function Subnav({ itens }: { itens: ItemSubnav[] }) {
  const atual = usePathname();
  return (
    <nav className="mb-8 flex gap-1 overflow-x-auto rounded-full border border-areia-200 bg-white p-1 sm:w-fit">
      {itens.map((item) => {
        const ativo = atual === item.href || atual.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              ativo ? "bg-sol-400 text-verde-900" : "text-verde-800 hover:bg-areia-100"
            }`}
          >
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
