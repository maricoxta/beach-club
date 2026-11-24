import { Subnav } from "@/components/agenda/subnav";

export default function LayoutAgenda({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Subnav
        itens={[
          { href: "/admin/calendario", rotulo: "Calendário" },
          { href: "/admin/agenda", rotulo: "Agenda da semana" },
          { href: "/admin/turmas", rotulo: "Turmas" },
          { href: "/admin/quadras", rotulo: "Quadras" },
          { href: "/admin/equipe", rotulo: "Professores e equipe" },
        ]}
      />
      {children}
    </>
  );
}
