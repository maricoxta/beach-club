import type { Metadata } from "next";
import { CartaoParceiro } from "@/components/parceiros/cartao-parceiro";
import { Vazio } from "@/components/ui";
import { COLUNAS_PARCEIRO, type Parceiro } from "@/lib/parceiros";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "Parceiros" };

export default async function ParceirosAlunoPage() {
  const supabase = await createClient();
  // O RLS já entrega só os parceiros publicados e dentro da validade.
  const { data, error } = await supabase.from("parceiros").select(COLUNAS_PARCEIRO).order("ordem").order("nome");
  if (error) throw new Error("Não foi possível carregar os parceiros.");
  const parceiros = (data ?? []) as Parceiro[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-verde-900">Parceiros</h1>
        <p className="mt-1 text-tinta-suave">Benefícios exclusivos para alunos do clube. Mostre seu acesso ao app ou use o código.</p>
      </div>
      {parceiros.length === 0 ? (
        <Vazio>Os parceiros e vouchers do clube vão aparecer aqui em breve.</Vazio>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {parceiros.map((p) => (
            <CartaoParceiro key={p.id} parceiro={p} />
          ))}
        </div>
      )}
    </div>
  );
}
