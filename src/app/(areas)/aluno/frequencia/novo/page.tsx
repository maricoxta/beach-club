import type { Metadata } from "next";
import Link from "next/link";
import { hoje, isData } from "@/lib/agenda/datas";
import { getSessao } from "@/lib/sessao";
import { FormCheckin } from "./form-checkin";

export const instant = false;
export const metadata: Metadata = { title: "Novo check-in" };

export default async function NovoCheckinPage({ searchParams }: PageProps<"/aluno/frequencia/novo">) {
  const { perfil } = await getSessao();
  if (!perfil) return null;
  const { dia } = await searchParams;
  const max = hoje();
  const data = typeof dia === "string" && isData(dia) && dia <= max ? dia : max;

  return (
    <div className="mx-auto w-full max-w-xl">
      <Link href={`/aluno/frequencia?dia=${data}`} className="text-sm font-semibold text-verde-700 hover:underline">
        ← Voltar para o calendário
      </Link>
      <h1 className="mb-6 mt-3 font-display text-3xl font-semibold text-verde-900">Novo check-in</h1>
      <FormCheckin alunoId={perfil.id} dataInicial={data} dataMaxima={max} />
    </div>
  );
}
