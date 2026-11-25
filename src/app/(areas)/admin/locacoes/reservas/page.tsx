import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho, classeBotaoSecundario, classeCampo, Vazio } from "@/components/agenda/ui";
import { formatarData, hoje, isData, somarDias } from "@/lib/agenda/datas";
import { moeda } from "@/lib/formato";
import { listarLocacoes, listarQuadras } from "@/lib/locacoes/dados";
import { horaMin } from "@/lib/locacoes/regras";
import { SeloPagamento, SeloStatusLocacao } from "../selos";

export const instant = false;
export const metadata: Metadata = { title: "Reservas de quadra" };

function Total({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded-3xl border p-4 ${destaque ? "border-erro/20 bg-erro/5" : "border-areia-200 bg-white"}`}>
      <p className="text-xs font-semibold text-tinta-suave">{rotulo}</p>
      <p className={`font-display text-2xl font-bold ${destaque ? "text-erro" : "text-verde-900"}`}>{moeda(valor)}</p>
    </div>
  );
}

export default async function ReservasPage({ searchParams }: PageProps<"/admin/locacoes/reservas">) {
  const sp = await searchParams;
  const dia = hoje();
  const de = isData(sp.de) ? sp.de : sp.status === "solicitada" ? dia : somarDias(dia, -7);
  const ate = isData(sp.ate) && sp.ate >= de ? sp.ate : somarDias(dia, 30);
  const pendentes = sp.pagamento === "pendente";
  const canceladas = sp.canceladas === "1";
  const soPedidos = sp.status === "solicitada";
  const quadraId = typeof sp.quadra === "string" && sp.quadra ? sp.quadra : undefined;

  const [quadras, todas] = await Promise.all([
    listarQuadras(),
    listarLocacoes({ de, ate, quadraId, incluirCanceladas: canceladas, status: soPedidos ? "solicitada" : undefined }),
  ]);
  const lista = pendentes
    ? todas.filter((l) => l.status !== "cancelada" && (l.pagamento === "a_pagar" || l.pagamento === "parcial"))
    : todas;
  const ativas = todas.filter((l) => l.status !== "cancelada");
  const total = ativas.reduce((s, l) => s + l.total, 0);
  const recebido = ativas.reduce((s, l) => s + l.pago, 0);
  const horas = ativas.reduce((s, l) => s + l.horas, 0);

  return (
    <>
      <Cabecalho
        titulo="Reservas e pagamentos"
        subtitulo={`Locações de ${formatarData(de, { day: "2-digit", month: "2-digit", year: "numeric" })} a ${formatarData(ate, { day: "2-digit", month: "2-digit", year: "numeric" })}.`}
      />

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-3xl border border-areia-200 bg-white p-4 text-xs font-semibold text-tinta-suave">
        <label className="flex flex-col gap-1">
          De
          <input type="date" name="de" defaultValue={de} className={classeCampo} />
        </label>
        <label className="flex flex-col gap-1">
          Até
          <input type="date" name="ate" defaultValue={ate} className={classeCampo} />
        </label>
        <label className="flex flex-col gap-1">
          Quadra
          <select name="quadra" defaultValue={quadraId ?? ""} className={classeCampo}>
            <option value="">Todas</option>
            {quadras.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Pagamento
          <select name="pagamento" defaultValue={pendentes ? "pendente" : ""} className={classeCampo}>
            <option value="">Todos</option>
            <option value="pendente">Só a receber</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Status
          <select name="status" defaultValue={soPedidos ? "solicitada" : ""} className={classeCampo}>
            <option value="">Todos</option>
            <option value="solicitada">Pedidos de alunos</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-3">
          <input type="checkbox" name="canceladas" value="1" defaultChecked={canceladas} className="accent-verde-700" />
          Mostrar canceladas
        </label>
        <button className={classeBotaoSecundario}>Filtrar</button>
      </form>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-3xl border border-areia-200 bg-white p-4">
          <p className="text-xs font-semibold text-tinta-suave">Locações</p>
          <p className="font-display text-2xl font-bold text-verde-900">
            {ativas.length} <span className="text-base font-semibold text-tinta-suave">· {horas}h</span>
          </p>
        </div>
        <Total rotulo="Valor reservado" valor={total} />
        <Total rotulo="Recebido" valor={recebido} />
        <Total rotulo="A receber" valor={Math.max(0, total - recebido)} destaque={total - recebido > 0} />
      </div>

      {lista.length === 0 ? (
        <Vazio>Nenhuma locação nesse filtro.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-areia-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-areia-50 text-left text-xs font-bold text-tinta-suave">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Horário</th>
                <th className="px-4 py-3">Quadra</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Recebido</th>
                <th className="px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-areia-100">
              {lista.map((l) => (
                <tr key={l.id} className={l.status === "cancelada" ? "opacity-60" : ""}>
                  <td className="px-4 py-3 font-semibold text-verde-900">
                    <Link href={`/admin/locacoes/${l.id}`} className="hover:underline">
                      {formatarData(l.data, { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {horaMin(l.ini)} às {horaMin(l.fim)}
                  </td>
                  <td className="px-4 py-3">{l.quadra}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/locacoes/${l.id}`} className="font-semibold text-verde-800 hover:underline">
                      {l.cliente}
                    </Link>
                    {l.telefone && <span className="block text-xs text-tinta-suave">{l.telefone}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{moeda(l.total)}</td>
                  <td className="px-4 py-3 text-right">{moeda(l.pago)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {l.status === "solicitada" && <SeloStatusLocacao status={l.status} />}
                      {l.status === "cancelada" ? (
                        <SeloStatusLocacao status={l.status} />
                      ) : (
                        <SeloPagamento situacao={l.pagamento} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
