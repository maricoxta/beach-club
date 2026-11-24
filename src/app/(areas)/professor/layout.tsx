import { AreaShell } from "@/components/area-shell";
import { exigirArea } from "@/lib/sessao";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export default async function Layout({ children }: LayoutProps<"/professor">) {
  const perfil = await exigirArea("professor");
  return (
    <AreaShell perfil={perfil} menu={[
        { href: "/professor", rotulo: "Hoje" },
        { rotulo: "Minhas turmas" },
        { rotulo: "Presença" },
      ]}>
      {children}
    </AreaShell>
  );
}
