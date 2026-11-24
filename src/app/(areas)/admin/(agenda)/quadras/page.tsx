import type { Metadata } from "next";
import { Cabecalho, Cartao, Vazio } from "@/components/agenda/ui";
import { createClient } from "@/lib/supabase/server";
import { salvarQuadra } from "../acoes";
import { FormQuadra, type Quadra } from "./form-quadra";

export const instant = false;
export const metadata: Metadata = { title: "Quadras" };

export default async function QuadrasPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quadras").select("id, nome, descricao, valor_hora, ativo").order("nome");
  if (error) throw new Error("Não foi possível carregar as quadras.");
  const quadras = (data ?? []) as Quadra[];

  return (
    <>
      <Cabecalho titulo="Quadras" subtitulo="Usadas nas turmas e na locação avulsa (valor por hora)." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-3">
          {quadras.length === 0 ? (
            <Vazio>Nenhuma quadra cadastrada. Use o formulário ao lado.</Vazio>
          ) : (
            quadras.map((q) => (
              <Cartao key={q.id} className={q.ativo ? "" : "opacity-60"}>
                <FormQuadra acao={salvarQuadra.bind(null, q.id)} quadra={q} />
              </Cartao>
            ))
          )}
        </section>
        <aside>
          <Cartao>
            <h2 className="mb-3 font-display text-lg font-semibold text-verde-900">Nova quadra</h2>
            <FormQuadra acao={salvarQuadra.bind(null, null)} />
          </Cartao>
        </aside>
      </div>
    </>
  );
}
