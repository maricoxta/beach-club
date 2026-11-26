import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BotaoExcluirParceiro } from "@/components/parceiros/botao-excluir-parceiro";
import { CartaoParceiro } from "@/components/parceiros/cartao-parceiro";
import { FormParceiro } from "@/components/parceiros/form-parceiro";
import { Painel } from "@/components/ui";
import { COLUNAS_PARCEIRO, type Parceiro } from "@/lib/parceiros";
import { excluirParceiro, salvarParceiro } from "@/lib/parceiros-acoes";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "Editar parceiro" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ParceiroPage({ params }: PageProps<"/admin/parceiros/[id]">) {
  const [{ id }, { perfil }] = await Promise.all([params, getSessao()]);
  if (perfil?.papel !== "admin") redirect("/admin/parceiros");
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("parceiros").select(COLUNAS_PARCEIRO).eq("id", id).maybeSingle();
  if (!data) notFound();
  const parceiro = data as Parceiro;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/parceiros" className="text-sm font-semibold text-verde-700 hover:underline">
            ← Parceiros
          </Link>
          <h1 className="mt-1 font-display text-3xl font-semibold text-verde-900">{parceiro.nome}</h1>
        </div>
        <BotaoExcluirParceiro acao={excluirParceiro.bind(null, parceiro.id)} nome={parceiro.nome} />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <Painel>
          {/* key: remonta o form com os dados novos depois de salvar */}
          <FormParceiro key={`${parceiro.nome}-${parceiro.logo_path}`} acao={salvarParceiro.bind(null, parceiro.id)} parceiro={parceiro} />
        </Painel>
        <aside className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-tinta-suave">Como o aluno vê (depois de salvar)</p>
          <CartaoParceiro parceiro={parceiro} />
        </aside>
      </div>
    </div>
  );
}
