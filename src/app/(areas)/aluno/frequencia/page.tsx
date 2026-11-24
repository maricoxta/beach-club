import type { Metadata } from "next";
import { PainelFrequencia } from "@/components/frequencia/painel-frequencia";
import { lerFiltros } from "@/lib/frequencia";
import { carregarFrequencia } from "@/lib/frequencia-dados";
import { getSessao } from "@/lib/sessao";

export const instant = false;
export const metadata: Metadata = { title: "Frequência" };

export default async function FrequenciaPage({ searchParams }: PageProps<"/aluno/frequencia">) {
  const { perfil } = await getSessao();
  if (!perfil) return null;
  const params = await searchParams;
  const { hoje, mes, dia } = lerFiltros(params);
  const { resumo, atividades, grade } = await carregarFrequencia(perfil.id, mes);

  return (
    <PainelFrequencia
      nome={perfil.nome}
      resumo={resumo}
      atividades={atividades}
      grade={grade}
      mes={mes}
      dia={dia}
      hoje={hoje}
      base="/aluno/frequencia"
      editavel
      salvo={params.ok === "1"}
    />
  );
}
