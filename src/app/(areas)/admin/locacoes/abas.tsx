"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/admin/locacoes", rotulo: "Grade de quadras" },
  { href: "/admin/locacoes/reservas", rotulo: "Reservas e pagamentos" },
];

export function AbasLocacoes() {
  const pathname = usePathname();
  const reservas = pathname.startsWith("/admin/locacoes/reservas");
  return (
    <div className="mb-6 inline-flex rounded-full border border-areia-200 bg-white p-1">
      {ABAS.map((aba) => {
        const ativa = aba.href === "/admin/locacoes/reservas" ? reservas : !reservas;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition sm:px-5 ${
              ativa ? "bg-sol-400 text-verde-900" : "text-tinta-suave hover:text-verde-800"
            }`}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </div>
  );
}
