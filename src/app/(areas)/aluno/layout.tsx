import { AreaShell } from "@/components/area-shell";
import { OuvirMensagens } from "@/components/chat/ouvir-mensagens";
import { exigirArea } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export default async function Layout({ children }: LayoutProps<"/aluno">) {
  const perfil = await exigirArea("aluno");
  // Avisos de vaga liberada ainda não vistos (zera ao abrir /aluno/avisos).
  const supabase = await createClient();
  const [{ data: naoLidos }, { data: mensagensNovas }] = await Promise.all([
    supabase.rpc("contar_avisos_nao_lidos"),
    // Respostas da recepção ainda não lidas (zera ao abrir /aluno/mensagens).
    supabase.rpc("contar_mensagens_nao_lidas"),
  ]);
  return (
    <AreaShell perfil={perfil} menu={[
        { href: "/aluno", rotulo: "Início" },
        { href: "/aluno/agenda", rotulo: "Minha agenda" },
        { href: "/aluno/avisos", rotulo: naoLidos ? `Avisos (${naoLidos})` : "Avisos" },
        { href: "/aluno/mensagens", rotulo: mensagensNovas ? `Mensagens (${mensagensNovas})` : "Mensagens" },
        { href: "/aluno/frequencia", rotulo: "Frequência" },
        { href: "/aluno/quadras", rotulo: "Alugar quadra" },
        { href: "/aluno/plano", rotulo: "Plano e pagamentos" },
      ]}>
      <OuvirMensagens alunoId={perfil.id} />
      {children}
    </AreaShell>
  );
}
