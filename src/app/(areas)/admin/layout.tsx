import { AreaShell } from "@/components/area-shell";
import { exigirArea } from "@/lib/sessao";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export default async function Layout({ children }: LayoutProps<"/admin">) {
  const perfil = await exigirArea("admin");
  return (
    <AreaShell perfil={perfil} menu={[
        { href: "/admin", rotulo: "Painel" },
        { href: "/admin/agenda", rotulo: "Agenda e turmas" },
        { href: "/admin/alunos", rotulo: "Alunos e planos" },
        { href: "/admin/financeiro", rotulo: "Financeiro" },
        { rotulo: "Locação de quadras" },
      ]}>
      {children}
    </AreaShell>
  );
}
