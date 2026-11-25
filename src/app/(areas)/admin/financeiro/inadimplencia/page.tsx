import type { Metadata } from "next";
import Link from "next/link";
import { Indicador } from "@/components/financeiro/ui";
import { Selo, Vazio, classeBotaoSecundario } from "@/components/ui";
import { linkWhatsApp, rotuloMesCurto, type MensalidadeView } from "@/lib/financeiro";
import { data, moeda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Inadimplência" };

type Devedor = {
  aluno_id: string;
  aluno_nome: string;
  mensalidades_vencidas: number;
  valor_em_aberto: number;
  vencimento_mais_antigo: string;
  dias_em_atraso: number;
};

function faixa(dias: number) {
  if (dias > 60) return { rotulo: `${dias} dias`, cor: "erro" } as const;
  if (dias > 15) return { rotulo: `${dias} dias`, cor: "sol" } as const;
  return { rotulo: `${dias} ${dias === 1 ? "dia" : "dias"}`, cor: "cinza" } as const;
}

export default async function InadimplenciaPage() {
  const supabase = await createClient();
  const [{ data: devs }, { data: vencidas }] = await Promise.all([
    supabase.from("vw_inadimplencia").select("*").order("valor_em_aberto", { ascending: false }),
    supabase
      .from("vw_mensalidades")
      .select("id, aluno_id, competencia, vencimento, saldo")
      .eq("vencida", true)
      .order("competencia"),
  ]);
  const devedores = (devs ?? []) as Devedor[];
  const ids = devedores.map((d) => d.aluno_id);
  const { data: contatos } = ids.length
    ? await supabase.from("perfis").select("id, telefone, email").in("id", ids)
    : { data: [] };
  const contatoPor = new Map((contatos ?? []).map((c) => [c.id, c as { id: string; telefone: string | null; email: string | null }]));

  const mensPor = new Map<string, Pick<MensalidadeView, "id" | "competencia" | "vencimento" | "saldo">[]>();
  for (const m of (vencidas ?? []) as MensalidadeView[]) {
    mensPor.set(m.aluno_id, [...(mensPor.get(m.aluno_id) ?? []), m]);
  }

  const total = devedores.reduce((s, d) => s + Number(d.valor_em_aberto), 0);
  const qtdMens = devedores.reduce((s, d) => s + Number(d.mensalidades_vencidas), 0);
  const mais30 = devedores.filter((d) => d.dias_em_atraso > 30).length;

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-verde-900">Inadimplência</h1>
        <p className="mt-1 text-tinta-suave">Alunos com mensalidade em aberto depois do vencimento, do maior valor para o menor.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Total vencido" valor={moeda(total)} cor={total > 0 ? "erro" : "neutro"} />
        <Indicador rotulo="Alunos" valor={String(devedores.length)} />
        <Indicador rotulo="Mensalidades" valor={String(qtdMens)} />
        <Indicador rotulo="Há mais de 30 dias" valor={String(mais30)} cor={mais30 > 0 ? "sol" : "neutro"} />
      </div>

      {devedores.length === 0 ? (
        <Vazio>Nenhuma mensalidade vencida. Tudo em dia!</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-areia-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-areia-200 bg-areia-50 text-xs uppercase tracking-wider text-tinta-suave">
              <tr>
                <th className="px-5 py-3 font-bold">Aluno</th>
                <th className="px-5 py-3 font-bold">Meses em aberto</th>
                <th className="px-5 py-3 font-bold">Atraso</th>
                <th className="px-5 py-3 text-right font-bold">Em aberto</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-areia-100">
              {devedores.map((d) => {
                const contato = contatoPor.get(d.aluno_id);
                const mens = mensPor.get(d.aluno_id) ?? [];
                const f = faixa(d.dias_em_atraso);
                const whats = linkWhatsApp(
                  contato?.telefone,
                  `Olá, ${d.aluno_nome.split(" ")[0]}! Consta em aberto ${moeda(d.valor_em_aberto)} ` +
                    `de mensalidade (${mens.map((m) => rotuloMesCurto(m.competencia.slice(0, 7))).join(", ")}). ` +
                    `Podemos ajudar a regularizar?`,
                );
                return (
                  <tr key={d.aluno_id} className="align-top transition hover:bg-areia-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/alunos/${d.aluno_id}`} className="font-bold text-verde-900 hover:underline">
                        {d.aluno_nome}
                      </Link>
                      <p className="text-xs text-tinta-suave">{contato?.telefone ?? contato?.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {mens.map((m) => (
                          <Link
                            key={m.id}
                            href={`/admin/financeiro/mensalidades/${m.id}`}
                            title={`Venceu em ${data(m.vencimento)} · ${moeda(m.saldo)}`}
                            className="rounded-full bg-erro/10 px-2.5 py-0.5 text-xs font-bold text-erro hover:bg-erro/20"
                          >
                            {rotuloMesCurto(m.competencia.slice(0, 7))}
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Selo cor={f.cor}>{f.rotulo}</Selo>
                      <p className="mt-1 text-xs text-tinta-suave">desde {data(d.vencimento_mais_antigo)}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-erro">{moeda(d.valor_em_aberto)}</td>
                    <td className="px-5 py-3 text-right">
                      {whats ? (
                        <a href={whats} target="_blank" rel="noopener noreferrer" className={classeBotaoSecundario}>
                          Cobrar no WhatsApp
                        </a>
                      ) : (
                        <span className="text-xs text-tinta-suave">sem telefone</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
