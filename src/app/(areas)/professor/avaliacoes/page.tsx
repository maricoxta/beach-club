import type { Metadata } from "next";
import { CartoesResumo, ListaAvaliacoes, REGRA_ANONIMATO, type AvaliacaoAula, type ResumoProfessor } from "@/components/agenda/avaliacoes";
import { Cabecalho } from "@/components/agenda/ui";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "Avaliações" };

export default async function AvaliacoesProfessorPage() {
  const supabase = await createClient();
  // A RPC devolve só as avaliações deste professor, já liberadas (regra de anonimato).
  const [resumoRes, itensRes] = await Promise.all([
    supabase.rpc("resumo_avaliacoes"),
    supabase.rpc("avaliacoes_liberadas").limit(300),
  ]);
  for (const r of [resumoRes, itensRes]) if (r.error) console.error("[agenda] avaliacoes:", r.error.code, r.error.message);
  return (
    <>
      <Cabecalho titulo="Avaliações das suas aulas" subtitulo="Notas e comentários dos alunos. As avaliações são anônimas." />
      <div className="mb-8">
        <CartoesResumo resumo={(resumoRes.data ?? []) as ResumoProfessor[]} />
          <p className="mt-2 text-xs text-tinta-suave">{REGRA_ANONIMATO}</p>
      </div>
      <ListaAvaliacoes itens={(itensRes.data ?? []) as unknown as AvaliacaoAula[]} />
    </>
  );
}
