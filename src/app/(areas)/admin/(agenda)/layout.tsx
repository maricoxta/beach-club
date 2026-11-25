import { Subnav } from "@/components/agenda/subnav";
import { contarDesmarcacoesPendentes } from "@/lib/agenda/consultas";

export default async function LayoutAgenda({ children }: { children: React.ReactNode }) {
  const desmarcacoes = await contarDesmarcacoesPendentes();
  return (
    <>
      <Subnav
        itens={[
          { href: "/admin/calendario", rotulo: "Calendário" },
          { href: "/admin/agenda", rotulo: "Agenda da semana" },
          { href: "/admin/vagas", rotulo: desmarcacoes ? `Vagas para reposição (${desmarcacoes})` : "Vagas para reposição" },
          { href: "/admin/avaliacoes", rotulo: "Avaliações" },
          { href: "/admin/turmas", rotulo: "Turmas" },
          { href: "/admin/quadras", rotulo: "Quadras" },
          { href: "/admin/equipe", rotulo: "Professores e equipe" },
        ]}
      />
      {children}
    </>
  );
}
