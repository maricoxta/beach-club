import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho, Vazio } from "@/components/agenda/ui";
import { quandoCurto, type ItemCaixa } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";
import { NovaConversa } from "./nova-conversa";

export const instant = false;
export const metadata: Metadata = { title: "Mensagens" };

export default async function CaixaMensagensPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: alunos }] = await Promise.all([
    supabase.rpc("caixa_mensagens"),
    supabase.from("perfis").select("id, nome").eq("papel", "aluno").eq("ativo", true).order("nome"),
  ]);
  if (error) console.error("[chat] caixa_mensagens:", error.code, error.message);
  const conversas = (data ?? []) as ItemCaixa[];
  const naoLidas = conversas.filter((c) => c.nao_lidas > 0).length;

  return (
    <>
      <Cabecalho
        titulo="Mensagens"
        subtitulo={
          naoLidas
            ? `${naoLidas} conversa${naoLidas === 1 ? "" : "s"} com mensagem nova. Qualquer pessoa da recepção pode responder.`
            : "Conversas dos alunos com a recepção. Qualquer pessoa da recepção pode responder."
        }
        acoes={<NovaConversa alunos={alunos ?? []} />}
      />
      {error ? (
        <Vazio>Não foi possível carregar as conversas. Tente de novo em instantes.</Vazio>
      ) : conversas.length === 0 ? (
        <Vazio>Nenhuma conversa ainda. Quando um aluno mandar mensagem pelo app, ela aparece aqui.</Vazio>
      ) : (
        <ul className="divide-y divide-areia-200 overflow-hidden rounded-3xl border border-areia-200 bg-white shadow-sm">
          {conversas.map((c) => {
            const nova = c.nao_lidas > 0;
            return (
              <li key={c.aluno_id}>
                <Link
                  href={`/admin/mensagens/${c.aluno_id}`}
                  className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-areia-50 sm:px-5 ${nova ? "bg-sol-400/10" : ""}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-areia-200 font-display font-semibold text-verde-800">
                    {c.aluno
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`truncate text-verde-900 ${nova ? "font-bold" : "font-semibold"}`}>{c.aluno}</p>
                      <span className={`shrink-0 text-xs ${nova ? "font-bold text-verde-700" : "text-tinta-suave"}`}>
                        {quandoCurto(c.ultima_mensagem_em)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm ${nova ? "font-semibold text-tinta" : "text-tinta-suave"}`}>
                        {c.ultima_da_equipe && <span className="text-tinta-suave">Você: </span>}
                        {c.ultima_texto ?? ""}
                      </p>
                      {nova && (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-sol-400 px-1.5 text-[11px] font-bold text-verde-900">
                          {c.nao_lidas}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
