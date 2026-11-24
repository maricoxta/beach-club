"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/admin/alunos", rotulo: "Alunos" },
  { href: "/admin/alunos/planos", rotulo: "Planos" },
];

export function AbasAlunos() {
  const pathname = usePathname();
  const planos = pathname.startsWith("/admin/alunos/planos");
  return (
    <div className="mb-6 inline-flex rounded-full border border-areia-200 bg-white p-1">
      {ABAS.map((aba) => {
        const ativa = aba.href === "/admin/alunos/planos" ? planos : !planos;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={`rounded-full px-5 py-1.5 text-sm font-bold transition ${
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
