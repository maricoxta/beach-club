import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho, Vazio } from "@/components/agenda/ui";
import { Alerta, Selo } from "@/components/ui";
import { agora, DIAS_SEMANA, diaSemanaIso, formatarData, formatarDataLonga, hoje, isData, somarDias } from "@/lib/agenda/datas";
import { moeda } from "@/lib/formato";
import { horariosOcupados, listarMinhasLocacoes, listarQuadras } from "@/lib/locacoes/dados";
import { ANTECEDENCIA_PEDIDO_H, HORA_ABRE, HORA_FECHA, horaMin, instante, rotuloStatusAluno } from "@/lib/locacoes/regras";
import { getSessao } from "@/lib/sessao";
import { cancelarMinhaLocacao } from "./acoes";
import { BotaoCancelar } from "./botao-cancelar";

export const instant = false;
export const metadata: Metadata = { title: "Alugar quadra" };

const DIAS_VISIVEIS = 14;
const HORAS = Array.from({ length: HORA_FECHA - HORA_ABRE }, (_, i) => HORA_ABRE + i);
const corStatus = { solicitada: "sol", reservada: "verde", confirmada: "verde", concluida: "cinza", cancelada: "erro" } as const;

export default async function AlunoQuadrasPage({ searchParams }: PageProps<"/aluno/quadras">) {
  const sp = await searchParams;
  const { perfil } = await getSessao();
  const dia = hoje();
  const ultimo = somarDias(dia, DIAS_VISIVEIS - 1);
  const data = isData(sp.data) && sp.data >= dia && sp.data <= ultimo ? sp.data : dia;

  const [quadras, ocupados, minhas] = await Promise.all([
    listarQuadras(),
    horariosOcupados(data, data),
    listarMinhasLocacoes(perfil!.id, somarDias(dia, -1)),
  ]);
  const limite = agora() + ANTECEDENCIA_PEDIDO_H * 3600_000;
  const ativas = minhas.filter((l) => l.status !== "cancelada");
  const dias = Array.from({ length: DIAS_VISIVEIS }, (_, i) => somarDias(dia, i));

  return (
    <>
      <Cabecalho
        titulo="Alugar quadra"
        subtitulo="Escolha um horário livre e peça a reserva. A recepção confirma e combina o pagamento com você."
      />

      {sp.pedido && (
        <div className="mb-6">
          <Alerta tipo="ok">Pedido enviado! Ele aparece abaixo como “Aguardando confirmação” até a recepção responder.</Alerta>
        </div>
      )}

      {ativas.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-xl font-bold text-verde-900">Minhas locações</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ativas.map((l) => {
              const podeCancelar =
                l.status === "solicitada" || (l.pago === 0 && new Date(instante(l.data, l.ini)).getTime() > limite);
              return (
                <li key={l.id} className="flex items-start justify-between gap-3 rounded-3xl border border-areia-200 bg-white p-4 shadow-sm">
                  <div>
                    <p className="font-bold text-verde-900">
                      {DIAS_SEMANA[diaSemanaIso(l.data)].curto} {formatarData(l.data)} · {horaMin(l.ini)} às {horaMin(l.fim)}
                    </p>
                    <p className="text-sm text-tinta-suave">
                      {l.quadra} · {moeda(l.total)}
                      {l.pago > 0 && ` · pago ${moeda(l.pago)}`}
                    </p>
                    <div className="mt-2">
                      <Selo cor={corStatus[l.status]}>{rotuloStatusAluno[l.status]}</Selo>
                    </div>
                  </div>
                  {podeCancelar && (
                    <BotaoCancelar
                      acao={cancelarMinhaLocacao.bind(null, l.id)}
                      rotulo={l.status === "solicitada" ? "Cancelar pedido" : "Cancelar"}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl font-bold text-verde-900">Horários livres</h2>
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {dias.map((d) => (
            <Link
              key={d}
              href={`/aluno/quadras?data=${d}`}
              aria-current={d === data ? "date" : undefined}
              className={`flex min-w-14 flex-col items-center rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                d === data ? "bg-verde-700 text-white" : "border border-areia-200 bg-white text-verde-900 hover:border-verde-600"
              }`}
            >
              <span>{DIAS_SEMANA[diaSemanaIso(d)].curto}</span>
              <span className="text-base font-bold">{d.slice(8)}</span>
            </Link>
          ))}
        </div>
        <p className="mb-3 text-sm capitalize text-tinta-suave">{formatarDataLonga(data)}</p>

        {quadras.length === 0 ? (
          <Vazio>Nenhuma quadra disponível no momento.</Vazio>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-areia-200 bg-white p-3 shadow-sm">
            <table className="w-full border-separate border-spacing-1 text-sm" style={{ minWidth: `${80 + quadras.length * 110}px` }}>
              <thead>
                <tr>
                  <th className="w-12" />
                  {quadras.map((q) => (
                    <th key={q.id} className="rounded-xl bg-areia-100 px-2 py-2 text-xs font-bold text-verde-900">
                      {q.nome}
                      <span className="block text-[11px] font-semibold opacity-70">{moeda(q.valor_hora)}/h</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HORAS.map((h) => (
                  <tr key={h}>
                    <th className="pr-1 text-right text-xs font-semibold text-tinta-suave">{h}h</th>
                    {quadras.map((q) => {
                      const ocupado = ocupados.some(
                        (o) => o.quadra_id === q.id && o.inicio_min < (h + 1) * 60 && o.fim_min > h * 60,
                      );
                      const cedo = new Date(instante(data, h * 60)).getTime() < limite;
                      return (
                        <td key={q.id} className="h-10">
                          {ocupado ? (
                            <div className="flex h-10 items-center justify-center rounded-xl bg-areia-100 text-xs text-tinta-suave/70">
                              Ocupado
                            </div>
                          ) : cedo ? (
                            <div className="h-10 rounded-xl bg-areia-50" />
                          ) : (
                            <Link
                              href={`/aluno/quadras/pedir?quadra=${q.id}&data=${data}&hora=${h}`}
                              className="flex h-10 items-center justify-center rounded-xl border-2 border-verde-600/30 bg-verde-50 text-xs font-bold text-verde-700 transition hover:border-verde-600 hover:bg-verde-600 hover:text-white"
                            >
                              Livre
                            </Link>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-tinta-suave">
          Pedidos com pelo menos {ANTECEDENCIA_PEDIDO_H} horas de antecedência, para os próximos dias. Você pode ter até 2 pedidos aguardando
          resposta.
        </p>
      </section>
    </>
  );
}
