import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/form-acao";
import {
  Campo,
  Painel,
  Selo,
  Vazio,
  classeBotaoPerigo,
  classeBotaoSecundario,
  classeCampo,
} from "@/components/ui";
import {
  FORMAS_PAGAMENTO,
  linkWhatsApp,
  rotuloMes,
  situacao,
  type FormaPagamento,
  type MensalidadeView,
} from "@/lib/financeiro";
import { data, hojeISO, moeda } from "@/lib/formato";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import {
  estornarPagamento,
  mudarStatusMensalidade,
  registrarPagamento,
  salvarMensalidade,
} from "../../acoes";

export const instant = false;

export const metadata: Metadata = { title: "Mensalidade" };

type Pagamento = {
  id: string;
  valor: number;
  pago_em: string;
  forma: FormaPagamento;
  observacao: string | null;
  autor: { nome: string } | null;
};

// "350" -> "350,00" para preencher campos de valor.
function decimal(valor: number | string) {
  return Number(valor).toFixed(2).replace(".", ",");
}

// Data/hora de pagamento (timestamptz) no fuso do clube.
function dataPagamento(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(iso));
}

export default async function MensalidadePage({ params }: PageProps<"/admin/financeiro/mensalidades/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: linha } = await supabase.from("vw_mensalidades").select("*").eq("id", id).maybeSingle();
  if (!linha) notFound();
  const m = linha as MensalidadeView;

  const [{ data: matricula }, { data: aluno }, { data: pags }, { perfil }] = await Promise.all([
    supabase
      .from("matriculas")
      .select("status, dia_vencimento, valor_mensal, planos(nome, modalidades(nome))")
      .eq("id", m.matricula_id)
      .maybeSingle(),
    supabase.from("perfis").select("email, telefone").eq("id", m.aluno_id).maybeSingle(),
    supabase
      .from("pagamentos")
      .select("id, valor, pago_em, forma, observacao, autor:perfis!registrado_por(nome)")
      .eq("mensalidade_id", id)
      .order("pago_em"),
    getSessao(),
  ]);
  const pagamentos = (pags ?? []) as unknown as Pagamento[];
  const plano = (matricula?.planos ?? null) as unknown as { nome: string; modalidades: { nome: string } | null } | null;
  const s = situacao(m);
  const mes = m.competencia.slice(0, 7);
  const admin = perfil?.papel === "admin";
  const whats =
    m.status === "aberta"
      ? linkWhatsApp(
          aluno?.telefone,
          `Olá, ${m.aluno_nome.split(" ")[0]}! A mensalidade de ${rotuloMes(mes)} (${moeda(m.saldo)}) ` +
            `${m.vencida ? "venceu" : "vence"} em ${data(m.vencimento)}. Qualquer dúvida, estamos à disposição.`,
        )
      : null;

  return (
    <>
      <Link href={`/admin/financeiro?mes=${mes}`} className="text-sm font-semibold text-verde-700 hover:underline">
        ← Mensalidades de {rotuloMes(mes)}
      </Link>

      <div className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold text-verde-900">{m.aluno_nome}</h1>
            <Selo cor={s.cor}>{s.rotulo}</Selo>
          </div>
          <p className="mt-1 text-tinta-suave">
            Mensalidade de <span className="capitalize">{rotuloMes(mes)}</span>
            {plano && ` · ${plano.nome}`}
            {plano?.modalidades && ` (${plano.modalidades.nome})`}
            {matricula && matricula.status !== "ativa" && ` · matrícula ${matricula.status}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {whats && (
            <a href={whats} target="_blank" rel="noopener noreferrer" className={classeBotaoSecundario}>
              Lembrar no WhatsApp
            </a>
          )}
          <Link href={`/admin/alunos/${m.aluno_id}`} className={classeBotaoSecundario}>
            Ficha do aluno
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <Painel titulo="Resumo">
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Vencimento</dt>
                <dd className={`mt-1 font-semibold ${m.vencida ? "text-erro" : "text-verde-900"}`}>{data(m.vencimento)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Valor</dt>
                <dd className="mt-1 font-semibold text-verde-900">{moeda(m.valor_liquido)}</dd>
                {Number(m.desconto) > 0 && (
                  <dd className="text-xs text-tinta-suave">
                    {moeda(m.valor)} − {moeda(m.desconto)}
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Pago</dt>
                <dd className="mt-1 font-semibold text-verde-700">{moeda(m.valor_pago)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Saldo</dt>
                <dd className={`mt-1 font-semibold ${Number(m.saldo) > 0 ? "text-erro" : "text-verde-900"}`}>
                  {moeda(m.status === "cancelada" ? 0 : m.saldo)}
                </dd>
              </div>
            </dl>
            {m.observacao && <p className="mt-4 text-sm italic text-tinta-suave">{m.observacao}</p>}
          </Painel>

          <Painel titulo="Pagamentos">
            {pagamentos.length === 0 ? (
              <Vazio>Nenhum pagamento registrado.</Vazio>
            ) : (
              <ul className="divide-y divide-areia-100">
                {pagamentos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="text-sm">
                      <p className="font-bold text-verde-900">
                        {moeda(p.valor)} <span className="font-semibold text-tinta-suave">· {FORMAS_PAGAMENTO[p.forma]}</span>
                      </p>
                      <p className="text-xs text-tinta-suave">
                        {dataPagamento(p.pago_em)}
                        {p.autor && ` · registrado por ${p.autor.nome}`}
                        {p.observacao && ` · ${p.observacao}`}
                      </p>
                    </div>
                    {admin && (
                      <details className="relative">
                        <summary className={`${classeBotaoPerigo} cursor-pointer list-none`}>Estornar</summary>
                        <div className="absolute right-0 z-10 mt-2 w-64 rounded-2xl border border-areia-200 bg-white p-4 shadow-lg">
                          <p className="mb-3 text-sm text-tinta">
                            Apaga este pagamento e reabre a mensalidade se o saldo voltar a ficar em aberto.
                          </p>
                          <FormAcao
                            acao={estornarPagamento}
                            rotulo="Confirmar estorno"
                            rotuloPendente="Estornando…"
                            classeBotaoEnviar={classeBotaoPerigo}
                            className="flex flex-col gap-2"
                          >
                            <input type="hidden" name="id" value={p.id} />
                          </FormAcao>
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Painel>

          {m.status !== "cancelada" && (
            <Painel titulo="Ajustar mensalidade">
              <FormAcao acao={salvarMensalidade} rotulo="Salvar ajustes" classeBotaoEnviar={classeBotaoSecundario}>
                <input type="hidden" name="id" value={m.id} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Campo rotulo="Vencimento">
                    <input name="vencimento" type="date" defaultValue={m.vencimento} required className={classeCampo} />
                  </Campo>
                  <Campo rotulo="Valor (R$)">
                    <input name="valor" inputMode="decimal" defaultValue={decimal(m.valor)} required className={classeCampo} />
                  </Campo>
                  <Campo rotulo="Desconto (R$)">
                    <input name="desconto" inputMode="decimal" defaultValue={decimal(m.desconto)} className={classeCampo} />
                  </Campo>
                </div>
                <Campo rotulo="Observação" dica="Ex.: desconto de irmãos, mês proporcional.">
                  <input name="observacao" defaultValue={m.observacao ?? ""} className={classeCampo} />
                </Campo>
              </FormAcao>
            </Painel>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {m.status === "aberta" && (
            <Painel titulo="Registrar pagamento" className="border-verde-600/30">
              <FormAcao acao={registrarPagamento} rotulo="Registrar pagamento" rotuloPendente="Registrando…">
                <input type="hidden" name="mensalidade_id" value={m.id} />
                <Campo rotulo="Valor recebido (R$)" dica={`Saldo em aberto: ${moeda(m.saldo)}. Valor menor fica como parcial.`}>
                  <input name="valor" inputMode="decimal" defaultValue={decimal(m.saldo)} required className={classeCampo} />
                </Campo>
                <Campo rotulo="Forma de pagamento">
                  <select name="forma" defaultValue="pix" className={classeCampo}>
                    {Object.entries(FORMAS_PAGAMENTO).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Data do pagamento">
                  <input name="data" type="date" defaultValue={hojeISO()} max={hojeISO()} required className={classeCampo} />
                </Campo>
                <Campo rotulo="Observação">
                  <input name="observacao" placeholder="Opcional" className={classeCampo} />
                </Campo>
              </FormAcao>
            </Painel>
          )}

          <Painel titulo="Situação">
            {m.status === "cancelada" ? (
              <FormAcao acao={mudarStatusMensalidade} rotulo="Reabrir mensalidade" classeBotaoEnviar={classeBotaoSecundario}>
                <p className="text-sm text-tinta-suave">Cancelada: não entra no previsto nem na inadimplência.</p>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="acao" value="reabrir" />
              </FormAcao>
            ) : Number(m.valor_pago) > 0 ? (
              <p className="text-sm text-tinta-suave">
                Para cancelar esta mensalidade, {admin ? "estorne" : "peça ao admin para estornar"} os pagamentos antes.
              </p>
            ) : (
              <details>
                <summary className={`${classeBotaoPerigo} inline-block cursor-pointer list-none`}>Cancelar mensalidade</summary>
                <div className="mt-3">
                  <FormAcao
                    acao={mudarStatusMensalidade}
                    rotulo="Confirmar cancelamento"
                    rotuloPendente="Cancelando…"
                    classeBotaoEnviar={classeBotaoPerigo}
                    className="flex flex-col gap-2"
                  >
                    <p className="text-sm text-tinta">
                      Use quando a cobrança não vale (ex.: aluno saiu antes do mês). Dá para reabrir depois.
                    </p>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="acao" value="cancelar" />
                  </FormAcao>
                </div>
              </details>
            )}
          </Painel>
        </div>
      </div>
    </>
  );
}
