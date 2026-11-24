import type { Metadata } from "next";
import { FormAcao } from "@/components/form-acao";
import { Painel, Selo, Vazio, classeBotaoSecundario } from "@/components/ui";
import { moeda, vezesPorSemana } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { criarPlano, salvarPlano } from "./actions";
import { CamposPlano, type Modalidade, type Plano } from "./campos-plano";

export const instant = false;

export const metadata: Metadata = { title: "Planos" };

export default async function PlanosPage() {
  const supabase = await createClient();
  const [{ data: planos }, { data: modalidades }, { data: matriculas }] = await Promise.all([
    supabase
      .from("planos")
      .select("id, nome, aulas_por_semana, valor_mensal, modalidade_id, ativo")
      .order("ativo", { ascending: false })
      .order("aulas_por_semana")
      .order("nome"),
    supabase.from("modalidades").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("matriculas").select("plano_id").eq("status", "ativa"),
  ]);

  const listaPlanos = (planos ?? []) as Plano[];
  const listaModalidades = (modalidades ?? []) as Modalidade[];
  const nomeModalidade = new Map(listaModalidades.map((m) => [m.id, m.nome]));
  const ativasPorPlano = new Map<string, number>();
  for (const m of matriculas ?? []) {
    ativasPorPlano.set(m.plano_id, (ativasPorPlano.get(m.plano_id) ?? 0) + 1);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-verde-900">Planos</h1>
          <p className="mt-1 text-tinta-suave">
            Frequência semanal e valor de cada plano. O valor é copiado para a matrícula, então mudar aqui não altera
            matrículas existentes.
          </p>
        </div>
        {listaPlanos.length === 0 && <Vazio>Nenhum plano cadastrado ainda. Crie o primeiro ao lado.</Vazio>}
        {listaPlanos.map((plano) => (
          <details key={plano.id} className="group rounded-3xl border border-areia-200 bg-white p-5 shadow-sm">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold text-verde-900">{plano.nome}</p>
                <p className="text-sm text-tinta-suave">
                  {vezesPorSemana(plano.aulas_por_semana)} ·{" "}
                  {plano.modalidade_id ? nomeModalidade.get(plano.modalidade_id) ?? "Modalidade inativa" : "Qualquer modalidade"}{" "}
                  · {ativasPorPlano.get(plano.id) ?? 0} matrícula(s) ativa(s)
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!plano.ativo && <Selo cor="cinza">Inativo</Selo>}
                <span className="font-display text-xl font-bold text-verde-700">{moeda(plano.valor_mensal)}</span>
                <span className={`${classeBotaoSecundario} group-open:hidden`}>Editar</span>
              </div>
            </summary>
            <div className="mt-5 border-t border-areia-100 pt-5">
              <FormAcao acao={salvarPlano} rotulo="Salvar alterações">
                <CamposPlano plano={plano} modalidades={listaModalidades} />
              </FormAcao>
            </div>
          </details>
        ))}
      </div>

      <Painel titulo="Novo plano" className="h-fit lg:sticky lg:top-6">
        <FormAcao acao={criarPlano} rotulo="Criar plano" limparAoSalvar>
          <CamposPlano modalidades={listaModalidades} />
        </FormAcao>
      </Painel>
    </div>
  );
}
