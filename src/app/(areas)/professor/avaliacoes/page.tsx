import type { Metadata } from "next";
import { CartoesResumo, ListaAvaliacoes, SELECT_AVALIACAO_AULA, type AvaliacaoAula, type ResumoProfessor } from "@/components/agenda/avaliacoes";
import { Cabecalho } from "@/components/agenda/ui";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "Avaliações" };

export default async function AvaliacoesProfessorPage() {
  const supabase = await createClient();
  // O RLS devolve só as avaliações das aulas deste professor.
  const [resumoRes, itensRes] = await Promise.all([
    supabase.rpc("resumo_avaliacoes"),
    supabase.from("avaliacoes_aula").select(SELECT_AVALIACAO_AULA).limit(200),
  ]);
  for (const r of [resumoRes, itensRes]) if (r.error) console.error("[agenda] avaliacoes:", r.error.code, r.error.message);
  return (
    <>
      <Cabecalho titulo="Avaliações das suas aulas" subtitulo="Notas e comentários dos alunos. As avaliações são anônimas." />
      <div className="mb-8">
        <CartoesResumo resumo={(resumoRes.data ?? []) as ResumoProfessor[]} />
      </div>
      <ListaAvaliacoes itens={(itensRes.data ?? []) as unknown as AvaliacaoAula[]} />
    </>
  );
}
