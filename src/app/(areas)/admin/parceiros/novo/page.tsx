import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormParceiro } from "@/components/parceiros/form-parceiro";
import { Painel } from "@/components/ui";
import { salvarParceiro } from "@/lib/parceiros-acoes";
import { getSessao } from "@/lib/sessao";

export const instant = false;
export const metadata: Metadata = { title: "Novo parceiro" };

export default async function NovoParceiroPage() {
  const { perfil } = await getSessao();
  if (perfil?.papel !== "admin") redirect("/admin/parceiros");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/parceiros" className="text-sm font-semibold text-verde-700 hover:underline">
          ← Parceiros
        </Link>
        <h1 className="mt-1 font-display text-3xl font-semibold text-verde-900">Novo parceiro</h1>
      </div>
      <Painel className="max-w-3xl">
        <FormParceiro acao={salvarParceiro.bind(null, null)} />
      </Painel>
    </div>
  );
}
