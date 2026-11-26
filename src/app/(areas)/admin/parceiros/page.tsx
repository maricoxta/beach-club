import type { Metadata } from "next";
import Link from "next/link";
import { Alerta, Painel, Selo, Vazio, classeBotao } from "@/components/ui";
import { data, hojeISO } from "@/lib/formato";
import { COLUNAS_PARCEIRO, iniciais, urlLogo, type Parceiro } from "@/lib/parceiros";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "Parceiros" };

function Situacao({ p, hoje }: { p: Parceiro; hoje: string }) {
  if (!p.ativo) return <Selo cor="cinza">Rascunho</Selo>;
  if (p.validade && p.validade < hoje) return <Selo cor="erro">Vencido em {data(p.validade)}</Selo>;
  return <Selo cor="verde">Publicado{p.validade ? ` até ${data(p.validade)}` : ""}</Selo>;
}

export default async function ParceirosAdminPage({ searchParams }: PageProps<"/admin/parceiros">) {
  const [{ perfil }, sp, supabase] = await Promise.all([getSessao(), searchParams, createClient()]);
  const admin = perfil?.papel === "admin";
  const { data: linhas, error } = await supabase.from("parceiros").select(COLUNAS_PARCEIRO).order("ordem").order("nome");
  if (error) throw new Error("Não foi possível carregar os parceiros.");
  const parceiros = (linhas ?? []) as Parceiro[];
  const hoje = hojeISO();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-verde-900">Parceiros</h1>
          <p className="mt-1 text-tinta-suave">
            Vouchers e benefícios que os alunos ativos veem na aba Parceiros.
            {!admin && " Só a administração cadastra e edita."}
          </p>
        </div>
        {admin && (
          <Link href="/admin/parceiros/novo" className={classeBotao}>
            Novo parceiro
          </Link>
        )}
      </div>

      {sp.criado && <Alerta tipo="ok">Parceiro cadastrado.</Alerta>}

      <Painel>
        {parceiros.length === 0 ? (
          <Vazio>Nenhum parceiro cadastrado ainda.</Vazio>
        ) : (
          <ul className="divide-y divide-areia-100">
            {parceiros.map((p) => {
              const logo = urlLogo(p.logo_path);
              const conteudo = (
                <>
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-areia-200 bg-white">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- logo no Storage público
                      <img src={logo} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <span className="font-display font-bold text-verde-700">{iniciais(p.nome)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-verde-900">
                      {p.nome}
                      {p.categoria && <span className="font-normal text-tinta-suave"> · {p.categoria}</span>}
                    </p>
                    <p className="truncate text-sm text-tinta-suave">{p.beneficio ?? "Benefício ainda não preenchido"}</p>
                  </div>
                  <Situacao p={p} hoje={hoje} />
                </>
              );
              return (
                <li key={p.id}>
                  {admin ? (
                    <Link href={`/admin/parceiros/${p.id}`} className="-mx-2 flex items-center gap-4 rounded-2xl px-2 py-3 transition hover:bg-areia-50">
                      {conteudo}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 py-3">{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Painel>
    </div>
  );
}
