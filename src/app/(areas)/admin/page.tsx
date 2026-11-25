import type { Metadata } from "next";
import { CartaoModulo, TituloArea } from "@/components/area-shell";
import { contarDesmarcacoesPendentes } from "@/lib/agenda/consultas";
import { getSessao } from "@/lib/sessao";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export const metadata: Metadata = { title: "Administração" };

export default async function AdminPage() {
  const { perfil } = await getSessao();
  const desmarcacoes = await contarDesmarcacoesPendentes();
  return (
    <>
      <TituloArea
        ola={`Olá, ${perfil?.nome.split(" ")[0]}!`}
        subtitulo="Administração e recepção do clube."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoModulo
          titulo="Agenda e turmas"
          descricao="Modalidade, nível, professor, quadra, horário, vagas e presença."
          href={desmarcacoes ? "/admin/vagas" : "/admin/agenda"}
          destaque={desmarcacoes ? `${desmarcacoes} desmarcaç${desmarcacoes === 1 ? "ão" : "ões"} para decidir` : undefined}
        />
        <CartaoModulo titulo="Alunos e planos" descricao="Matrículas e planos de 1x, 2x ou 3x por semana." href="/admin/alunos" />
        <CartaoModulo titulo="Financeiro" descricao="Mensalidades, pagamentos, inadimplência e relatório mensal." href="/admin/financeiro" />
        <CartaoModulo titulo="Locação de quadras" descricao="Reservas avulsas por hora, grade de quadras e pagamentos." href="/admin/locacoes" />
      </div>
    </>
  );
}
