import type { Metadata } from "next";
import { CartaoModulo, TituloArea } from "@/components/area-shell";
import { getSessao } from "@/lib/sessao";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export const metadata: Metadata = { title: "Professor" };

export default async function ProfessorPage() {
  const { perfil } = await getSessao();
  return (
    <>
      <TituloArea ola={`Bom treino, ${perfil?.nome.split(" ")[0]}!`} subtitulo="Sua agenda e suas turmas." />
      <div className="grid gap-4 sm:grid-cols-3">
        <CartaoModulo titulo="Aulas de hoje" descricao="Horários, quadras e turmas do dia." destaque="Em breve" />
        <CartaoModulo titulo="Minhas turmas" descricao="Alunos, níveis e vagas de cada turma." destaque="Em breve" />
        <CartaoModulo titulo="Presença" descricao="Faça a chamada direto da quadra." destaque="Em breve" />
      </div>
    </>
  );
}
