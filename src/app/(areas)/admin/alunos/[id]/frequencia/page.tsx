import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PainelFrequencia } from "@/components/frequencia/painel-frequencia";
import { lerFiltros } from "@/lib/frequencia";
import { carregarFrequencia } from "@/lib/frequencia-dados";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "Frequência do aluno" };

// Admin/recepção acompanham o calendário do aluno (só leitura; o RLS libera a leitura para staff).
export default async function FrequenciaAlunoPage({ params, searchParams }: PageProps<"/admin/alunos/[id]/frequencia">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: aluno } = await supabase.from("perfis").select("id, nome, papel").eq("id", id).maybeSingle();
  if (!aluno || aluno.papel !== "aluno") notFound();

  const { hoje, mes, dia } = lerFiltros(await searchParams);
  const { resumo, atividades, grade } = await carregarFrequencia(aluno.id, mes);

  return (
    <>
      <Link href={`/admin/alunos/${aluno.id}`} className="mb-4 inline-block text-sm font-semibold text-verde-700 hover:underline">
        ← Voltar para a ficha do aluno
      </Link>
      <PainelFrequencia
        nome={aluno.nome}
        resumo={resumo}
        atividades={atividades}
        grade={grade}
        mes={mes}
        dia={dia}
        hoje={hoje}
        base={`/admin/alunos/${aluno.id}/frequencia`}
        editavel={false}
      />
    </>
  );
}
