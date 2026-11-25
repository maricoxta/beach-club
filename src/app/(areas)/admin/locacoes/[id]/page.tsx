import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho, LinkVoltar } from "@/components/agenda/ui";
import { Alerta, Painel } from "@/components/ui";
import { agora, formatarDataLonga } from "@/lib/agenda/datas";
import { moeda } from "@/lib/formato";
import { buscarLocacao } from "@/lib/locacoes/dados";
import { horaMin, instante, paraLocal, rotuloForma, type FormaPagamento } from "@/lib/locacoes/regras";
import { mudarStatus, registrarPagamento } from "../acoes";
import { SeloPagamento, SeloStatusLocacao } from "../selos";
import { BotoesStatus } from "./botoes";
import { FormPagamento } from "./form-pagamento";

export const instant = false;
export const metadata: Metadata = { title: "Locação" };

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-areia-100 py-2 text-sm last:border-0">
      <dt className="text-tinta-suave">{rotulo}</dt>
      <dd className="text-right font-semibold text-verde-900">{children}</dd>
    </div>
  );
}

export default async function LocacaoPage({ params, searchParams }: PageProps<"/admin/locacoes/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const loc = await buscarLocacao(id);
  if (!loc) notFound();

  const cancelada = loc.status === "cancelada";
  const terminou = new Date(instante(loc.data, loc.fim)).getTime() < agora();
  const restante = Math.max(0, Math.round((loc.total - loc.pago) * 100) / 100);
  const whatsapp = loc.telefone?.replace(/\D/g, "");

  return (
    <>
      <LinkVoltar href={`/admin/locacoes?data=${loc.data}`}>Grade de quadras</LinkVoltar>
      <Cabecalho
        titulo={loc.cliente}
        subtitulo={`${loc.quadra} · ${formatarDataLonga(loc.data)} · ${horaMin(loc.ini)} às ${horaMin(loc.fim)}`}
        acoes={
          <>
            <SeloStatusLocacao status={loc.status} />
            {!cancelada && <SeloPagamento situacao={loc.pagamento} />}
          </>
        }
      />

      {loc.status === "solicitada" && (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-sol-500 bg-sol-400/15 px-4 py-3 text-sm font-semibold text-verde-900">
          Pedido feito pelo aluno no app. Aprove para confirmar a reserva ou recuse para liberar o horário.
        </div>
      )}
      {sp.criada && (
        <div className="mb-4">
          <Alerta tipo="ok">Locação reservada.</Alerta>
        </div>
      )}
      {sp.pagamento === "falhou" && (
        <div className="mb-4">
          <Alerta tipo="erro">A locação foi salva, mas o pagamento não. Registre o pagamento abaixo.</Alerta>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Painel titulo="Reserva">
          <dl>
            <Linha rotulo="Cliente">
              {loc.cliente}
              {loc.cliente_id && (
                <Link href={`/admin/alunos/${loc.cliente_id}`} className="ml-2 text-xs text-verde-700 underline">
                  aluno
                </Link>
              )}
            </Linha>
            <Linha rotulo="Telefone">
              {loc.telefone ? (
                whatsapp && whatsapp.length >= 10 ? (
                  <a
                    href={`https://wa.me/${whatsapp.length <= 11 ? `55${whatsapp}` : whatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-verde-700 underline"
                  >
                    {loc.telefone}
                  </a>
                ) : (
                  loc.telefone
                )
              ) : (
                "—"
              )}
            </Linha>
            <Linha rotulo="Duração">
              {loc.horas}h × {moeda(loc.valor_hora)}
            </Linha>
            <Linha rotulo="Total">{moeda(loc.total)}</Linha>
            <Linha rotulo="Recebido">{moeda(loc.pago)}</Linha>
            {!cancelada && restante > 0 && <Linha rotulo="Falta receber">{moeda(restante)}</Linha>}
            {loc.observacao && <Linha rotulo="Observação">{loc.observacao}</Linha>}
          </dl>
          {!cancelada && (
            <div className="mt-5">
              <BotoesStatus
                confirmar={mudarStatus.bind(null, loc.id, "confirmada")}
                cancelar={mudarStatus.bind(null, loc.id, "cancelada")}
                podeConfirmar={(loc.status === "reservada" || loc.status === "solicitada") && !terminou}
                pedido={loc.status === "solicitada"}
                avisoCancelar={
                  loc.status === "solicitada"
                    ? "O pedido do aluno é recusado e o horário volta a ficar livre."
                    : loc.pago > 0
                    ? `Já há ${moeda(loc.pago)} recebido. O cancelamento libera o horário; a devolução do dinheiro, se houver, é feita à parte.`
                    : "O horário volta a ficar livre na grade."
                }
              />
            </div>
          )}
        </Painel>

        <Painel titulo="Pagamentos">
          {loc.pagamentos.length === 0 ? (
            <p className="mb-4 text-sm text-tinta-suave">Nenhum pagamento registrado.</p>
          ) : (
            <ul className="mb-5 divide-y divide-areia-100 text-sm">
              {loc.pagamentos.map((p) => {
                const quando = paraLocal(p.pago_em);
                return (
                  <li key={p.id} className="flex justify-between py-2">
                    <span className="text-tinta-suave">
                      {quando.data.split("-").reverse().join("/")} {horaMin(quando.minutos)} ·{" "}
                      {rotuloForma[p.forma as FormaPagamento] ?? p.forma}
                    </span>
                    <span className="font-semibold text-verde-900">{moeda(p.valor)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {!cancelada && restante > 0 && (
            <FormPagamento acao={registrarPagamento.bind(null, loc.id)} restante={restante} />
          )}
          {!cancelada && restante === 0 && loc.total > 0 && (
            <p className="text-sm font-semibold text-verde-700">Locação quitada.</p>
          )}
        </Painel>
      </div>
    </>
  );
}
