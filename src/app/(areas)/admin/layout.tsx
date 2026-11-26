import { AreaShell } from "@/components/area-shell";
import { OuvirMensagens } from "@/components/chat/ouvir-mensagens";
import { contarDesmarcacoesPendentes } from "@/lib/agenda/consultas";
import { exigirArea } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export default async function Layout({ children }: LayoutProps<"/admin">) {
  const perfil = await exigirArea("admin");
  // Mensagens de alunos ainda não lidas pela equipe (atualiza ao vivo via OuvirMensagens).
  const supabase = await createClient();
  const [desmarcacoes, { data: mensagensNovas }] = await Promise.all([
    contarDesmarcacoesPendentes(),
    supabase.rpc("contar_mensagens_nao_lidas"),
  ]);
  return (
    <AreaShell perfil={perfil} menu={[
        { href: "/admin", rotulo: "Painel" },
        { href: "/admin/agenda", rotulo: desmarcacoes ? `Agenda e turmas (${desmarcacoes})` : "Agenda e turmas" },
        { href: "/admin/alunos", rotulo: "Alunos e planos" },
        { href: "/admin/financeiro", rotulo: "Financeiro" },
        { href: "/admin/locacoes", rotulo: "Locação de quadras" },
        { href: "/admin/mensagens", rotulo: mensagensNovas ? `Mensagens (${mensagensNovas})` : "Mensagens" },
        { href: "/admin/parceiros", rotulo: "Parceiros" },
      ]}>
      <OuvirMensagens />
      {children}
    </AreaShell>
  );
}
