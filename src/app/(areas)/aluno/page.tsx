import type { Metadata } from "next";
import { CartaoModulo, TituloArea } from "@/components/area-shell";
import { getSessao } from "@/lib/sessao";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export const metadata: Metadata = { title: "Aluno" };

export default async function AlunoPage() {
  const { perfil } = await getSessao();
  return (
    <>
      <TituloArea ola={`E aí, ${perfil?.nome.split(" ")[0]}!`} subtitulo="Suas aulas, seu plano e seus pagamentos." />
      <div className="grid gap-4 sm:grid-cols-3">
        <CartaoModulo titulo="Próximas aulas" descricao="Seus horários da semana e a quadra de cada aula." destaque="Em breve" />
        <CartaoModulo titulo="Meu plano" descricao="Frequência contratada e status da matrícula." destaque="Em breve" />
        <CartaoModulo titulo="Pagamentos" descricao="Mensalidades pagas e em aberto." destaque="Em breve" />
      </div>
    </>
  );
}
