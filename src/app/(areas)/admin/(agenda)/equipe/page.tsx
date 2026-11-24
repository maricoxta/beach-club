import type { Metadata } from "next";
import { Cabecalho, Cartao } from "@/components/agenda/ui";
import { isPapel, type Papel } from "@/lib/papel";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { alterarPapel } from "../acoes";
import { FormPapel } from "./form-papel";

export const instant = false;
export const metadata: Metadata = { title: "Professores e equipe" };

type PerfilEquipe = { id: string; nome: string; email: string | null; papel: Papel; ativo: boolean };

export default async function EquipePage({ searchParams }: PageProps<"/admin/equipe">) {
  const sp = await searchParams;
  const busca = typeof sp.q === "string" ? sp.q.trim() : "";
  const { perfil: eu } = await getSessao();
  const supabase = await createClient();

  let q = supabase.from("perfis").select("id, nome, email, papel, ativo").order("nome");
  if (busca) q = q.or(`nome.ilike.%${busca.replace(/[%,()]/g, "")}%,email.ilike.%${busca.replace(/[%,()]/g, "")}%`);
  else q = q.neq("papel", "aluno");
  const { data, error } = await q.limit(100);
  if (error) throw new Error("Não foi possível carregar a equipe.");
  const perfis = ((data ?? []) as PerfilEquipe[]).filter((p) => isPapel(p.papel));

  return (
    <>
      <Cabecalho
        titulo="Professores e equipe"
        subtitulo="Quem se cadastra pelo site entra como aluno. Busque a pessoa e mude o papel para professor, recepção ou admin."
      />
      <form className="mb-4 flex max-w-xl gap-2">
        <input
          name="q"
          defaultValue={busca}
          placeholder="Buscar por nome ou e-mail (inclui alunos)"
          className="w-full rounded-full border-2 border-areia-200 bg-white px-4 py-2 text-sm outline-none focus:border-verde-600"
        />
        <button className="rounded-full bg-verde-700 px-5 text-sm font-bold text-white">Buscar</button>
      </form>
      <Cartao className="p-0">
        {perfis.length === 0 ? (
          <p className="p-5 text-sm text-tinta-suave">Ninguém encontrado.</p>
        ) : (
          <ul className="divide-y divide-areia-100">
            {perfis.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className={`font-semibold ${p.ativo ? "text-tinta" : "text-tinta-suave line-through"}`}>{p.nome}</p>
                  <p className="text-xs text-tinta-suave">{p.email}</p>
                </div>
                <FormPapel
                  acao={alterarPapel.bind(null, p.id)}
                  papel={p.papel}
                  ativo={p.ativo}
                  bloqueado={p.id === eu?.id || (p.papel === "admin" && eu?.papel !== "admin")}
                  podeAdmin={eu?.papel === "admin"}
                />
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </>
  );
}
