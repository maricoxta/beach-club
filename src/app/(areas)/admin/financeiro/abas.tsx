"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/admin/financeiro", rotulo: "Mensalidades" },
  { href: "/admin/financeiro/inadimplencia", rotulo: "Inadimplência" },
  { href: "/admin/financeiro/relatorio", rotulo: "Relatório mensal" },
];

function ativa(pathname: string, href: string) {
  if (href === "/admin/financeiro") {
    return pathname === href || pathname.startsWith("/admin/financeiro/mensalidades");
  }
  return pathname.startsWith(href);
}

export function AbasFinanceiro() {
  const pathname = usePathname();
  return (
    <div className="mb-6 inline-flex max-w-full overflow-x-auto rounded-full border border-areia-200 bg-white p-1">
      {ABAS.map((aba) => (
        <Link
          key={aba.href}
          href={aba.href}
          aria-current={ativa(pathname, aba.href) ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-5 py-1.5 text-sm font-bold transition ${
            ativa(pathname, aba.href) ? "bg-sol-400 text-verde-900" : "text-tinta-suave hover:text-verde-800"
          }`}
        >
          {aba.rotulo}
        </Link>
      ))}
    </div>
  );
}
