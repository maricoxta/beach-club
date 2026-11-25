import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho, Vazio } from "@/components/agenda/ui";
import { Conversa } from "@/components/chat/conversa";
import { LIMITE_HISTORICO, type Mensagem } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "Conversa" };

const RE_UUID = /^[0-9a-f-]{36}$/i;

export default async function ConversaAdminPage({ params }: PageProps<"/admin/mensagens/[aluno]">) {
  const { aluno: alunoId } = await params;
  if (!RE_UUID.test(alunoId)) notFound();
  const supabase = await createClient();
  const [{ data: aluno }, { data: conversa }, { data, error }] = await Promise.all([
    supabase.from("perfis").select("id, nome, email, telefone, papel").eq("id", alunoId).maybeSingle(),
    supabase.from("conversas").select("equipe_leu_em").eq("aluno_id", alunoId).maybeSingle(),
    supabase
      .from("mensagens")
      .select("id, aluno_id, da_equipe, texto, created_at")
      .eq("aluno_id", alunoId)
      .order("id", { ascending: false })
      .limit(LIMITE_HISTORICO),
  ]);
  if (!aluno || aluno.papel !== "aluno") notFound();
  if (error) console.error("[chat] conversa:", error.code, error.message);
  const mensagens = ((data ?? []) as Mensagem[]).reverse();
  const leuEm = conversa?.equipe_leu_em ? Date.parse(conversa.equipe_leu_em) : 0;
  const temNaoLidas = mensagens.some((m) => !m.da_equipe && Date.parse(m.created_at) > leuEm);
  const primeiroNome = aluno.nome.split(" ")[0] || aluno.nome;

  return (
    <>
      <Link href="/admin/mensagens" className="mb-3 inline-block text-sm font-semibold text-verde-700 hover:underline">
        ← Todas as conversas
      </Link>
      <Cabecalho
        titulo={aluno.nome}
        subtitulo={[aluno.email, aluno.telefone].filter(Boolean).join(" · ") || undefined}
        acoes={
          <Link href={`/admin/alunos/${aluno.id}`} className="text-sm font-semibold text-verde-700 hover:underline">
            Ver cadastro do aluno →
          </Link>
        }
      />
      {error ? (
        <Vazio>Não foi possível carregar a conversa. Tente de novo em instantes.</Vazio>
      ) : (
        <Conversa
          mensagens={mensagens}
          lado="equipe"
          alunoId={aluno.id}
          nomeOutroLado={primeiroNome}
          temNaoLidas={temNaoLidas}
          vazio={`Nenhuma mensagem com ${primeiroNome} ainda. A mensagem que você enviar aparece para o aluno em "Mensagens".`}
        />
      )}
    </>
  );
}
