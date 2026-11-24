import Image from "next/image";
import { marca } from "@/lib/marca";

export function LogoMarca({ tamanho = 44 }: { tamanho?: number }) {
  return <Image src="/logo.png" alt="" width={tamanho} height={tamanho} priority />;
}

export function Logo({ tamanho = 44, claro = false }: { tamanho?: number; claro?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMarca tamanho={tamanho} />
      <span
        className={`font-display text-xl font-semibold tracking-tight ${claro ? "text-white" : "text-verde-800"}`}
      >
        {marca.nome}
      </span>
    </span>
  );
}
