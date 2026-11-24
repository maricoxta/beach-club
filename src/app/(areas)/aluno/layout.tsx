import { AreaShell } from "@/components/area-shell";
import { exigirArea } from "@/lib/sessao";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export default async function Layout({ children }: LayoutProps<"/aluno">) {
  const perfil = await exigirArea("aluno");
  return (
    <AreaShell perfil={perfil} menu={[
        { href: "/aluno", rotulo: "Início" },
        { rotulo: "Minhas aulas" },
        { rotulo: "Plano e pagamentos" },
      ]}>
      {children}
    </AreaShell>
  );
}
