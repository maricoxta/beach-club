import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho, classeBotao, classeBotaoSecundario, Vazio } from "@/components/agenda/ui";
import { agora, DIAS_SEMANA, diaSemanaIso, diasDaSemana, formatarData, formatarDataLonga, hoje, inicioDaSemana, isData, somarDias } from "@/lib/agenda/datas";
import { moeda } from "@/lib/formato";
import { contarPedidosPendentes, listarLocacoes, listarQuadras, ocupacaoTurmas, type Locacao, type OcupacaoTurma } from "@/lib/locacoes/dados";
import { HORA_ABRE, HORA_FECHA, horaMin, instante } from "@/lib/locacoes/regras";
import { SeloPagamento, SeloStatusLocacao } from "./selos";

export const instant = false;
export const metadata: Metadata = { title: "Locação de quadras" };

const HORAS = Array.from({ length: HORA_FECHA - HORA_ABRE }, (_, i) => HORA_ABRE + i);

type Contexto = { locacoes: Locacao[]; turmas: OcupacaoTurma[]; agoraMs: number };

function Celula({ ctx, data, quadraId, h }: { ctx: Contexto; data: string; quadraId: string; h: number }) {
  const ini = h * 60;
  const fim = ini + 60;
  const loc = ctx.locacoes.find((l) => l.quadra_id === quadraId && l.data === data && l.ini < fim && l.fim > ini);
  if (loc) {
    const primeira = loc.ini >= ini || h === HORA_ABRE;
    const cor =
      loc.status === "solicitada"
        ? "border-2 border-dashed border-sol-500 bg-sol-400/15 text-verde-900"
        : loc.pagamento === "a_pagar"
        ? "border-erro/30 bg-erro/10 text-erro"
        : loc.pagamento === "parcial"
          ? "border-sol-400 bg-sol-400/25 text-verde-900"
          : "border-verde-600/30 bg-verde-50 text-verde-800";
    return (
      <Link
        href={`/admin/locacoes/${loc.id}`}
        title={`${loc.cliente} · ${horaMin(loc.ini)} às ${horaMin(loc.fim)} · ${moeda(loc.total)}`}
        className={`flex h-full min-h-11 flex-col justify-center rounded-xl border px-2 py-1 text-xs font-semibold transition hover:brightness-95 ${cor}`}
      >
        {primeira ? (
          <>
            <span className="truncate font-bold">{loc.cliente}</span>
            <span className="truncate font-normal opacity-80">
              {loc.status === "solicitada" ? "Pedido do aluno" : "Locação"} · {loc.horas}h
            </span>
          </>
        ) : (
          <span className="opacity-70">↳ {loc.cliente.split(" ")[0]}</span>
        )}
      </Link>
    );
  }

  const turma =
    ctx.turmas.find((t) => t.quadra_id === quadraId && t.data === data && t.ini < fim && t.fim > ini && !t.remanejada) ??
    ctx.turmas.find((t) => t.quadra_id === quadraId && t.data === data && t.ini < fim && t.fim > ini);
  if (turma) {
    const conteudo = (
      <>
        <span className="truncate font-bold">{turma.turma}</span>
        <span className="truncate font-normal">{turma.remanejada ? "Aula trocada para cá" : "Aula"}</span>
      </>
    );
    const classe =
      "flex h-full min-h-11 flex-col justify-center rounded-xl border border-areia-300 bg-areia-100 px-2 py-1 text-xs text-tinta-suave";
    return turma.aulaId ? (
      <Link href={`/admin/agenda/aulas/${turma.aulaId}`} className={`${classe} hover:bg-areia-200`}>
        {conteudo}
      </Link>
    ) : (
      <div className={classe}>{conteudo}</div>
    );
  }

  const passou = new Date(instante(data, ini)).getTime() < ctx.agoraMs;
  if (passou) return <div className="min-h-11 rounded-xl bg-areia-50" aria-label="Livre (horário passado)" />;
  return (
    <Link
      href={`/admin/locacoes/nova?quadra=${quadraId}&data=${data}&hora=${h}`}
      className="group flex min-h-11 items-center justify-center rounded-xl border-2 border-dashed border-areia-200 text-xs font-semibold text-verde-700/0 transition hover:border-verde-600 hover:bg-verde-50 hover:text-verde-700 focus:text-verde-700"
      aria-label={`Reservar às ${h}h`}
    >
      + Reservar
    </Link>
  );
}

function Grade({
  colunas,
  celula,
}: {
  colunas: { chave: string; titulo: React.ReactNode; destaque?: boolean }[];
  celula: (chave: string, h: number) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-areia-200 bg-white p-3 shadow-sm">
      <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="w-14" />
            {colunas.map((c) => (
              <th
                key={c.chave}
                className={`rounded-xl px-2 py-2 text-xs font-bold ${c.destaque ? "bg-verde-700 text-white" : "bg-areia-100 text-verde-900"}`}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HORAS.map((h) => (
            <tr key={h}>
              <th className="pr-1 text-right align-middle text-xs font-semibold text-tinta-suave">{h}h</th>
              {colunas.map((c) => (
                <td key={c.chave} className="h-11 align-top">
                  {celula(c.chave, h)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legenda() {
  const item = (cor: string, texto: string) => (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${cor}`} />
      {texto}
    </span>
  );
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">
      {item("border-2 border-dashed border-areia-300", "Livre (clique para reservar)")}
      {item("bg-areia-200", "Aula de turma")}
      {item("bg-verde-50 border border-verde-600/30", "Locação paga")}
      {item("bg-sol-400/40", "Pago em parte")}
      {item("bg-erro/15", "A pagar")}
      {item("border-2 border-dashed border-sol-500", "Pedido de aluno (aguardando)")}
    </div>
  );
}

export default async function LocacoesPage({ searchParams }: PageProps<"/admin/locacoes">) {
  const sp = await searchParams;
  const dia = hoje();
  const data = isData(sp.data) ? sp.data : dia;
  const semana = sp.visao === "semana";
  const quadras = await listarQuadras();

  if (quadras.length === 0) {
    return (
      <>
        <Cabecalho titulo="Locação de quadras" />
        <Vazio>
          Nenhuma quadra ativa. Cadastre as quadras e o valor por hora em{" "}
          <Link href="/admin/quadras" className="font-semibold text-verde-700 underline">
            Agenda e turmas › Quadras
          </Link>
          .
        </Vazio>
      </>
    );
  }

  const quadraSel = quadras.find((q) => q.id === sp.quadra) ?? quadras[0];
  const de = semana ? inicioDaSemana(data) : data;
  const ate = semana ? somarDias(de, 6) : data;
  const [locacoes, turmas, pedidos] = await Promise.all([
    listarLocacoes({ de, ate, quadraId: semana ? quadraSel.id : undefined }),
    ocupacaoTurmas(de, ate),
    contarPedidosPendentes(),
  ]);
  const ctx: Contexto = { locacoes, turmas, agoraMs: agora() };

  const passo = semana ? 7 : 1;
  const url = (params: Record<string, string>) => {
    const p = new URLSearchParams({ data, ...(semana ? { visao: "semana", quadra: quadraSel.id } : {}), ...params });
    return `/admin/locacoes?${p}`;
  };

  const navegacao = (
    <div className="flex flex-wrap items-center gap-2">
      <Link className={classeBotaoSecundario} href={url({ data: somarDias(data, -passo) })} aria-label="Anterior">
        ←
      </Link>
      <span className="min-w-36 text-center font-display font-semibold text-verde-900">
        {semana ? `${formatarData(de)} a ${formatarData(ate)}` : formatarData(data, { weekday: "short", day: "2-digit", month: "2-digit" })}
      </span>
      <Link className={classeBotaoSecundario} href={url({ data: somarDias(data, passo) })} aria-label="Próximo">
        →
      </Link>
      {(semana ? inicioDaSemana(dia) !== de : data !== dia) && (
        <Link className={classeBotaoSecundario} href={url({ data: dia })}>
          Hoje
        </Link>
      )}
      <form action="/admin/locacoes" className="flex items-center gap-2">
        {semana && (
          <>
            <input type="hidden" name="visao" value="semana" />
            <input type="hidden" name="quadra" value={quadraSel.id} />
          </>
        )}
        <input
          type="date"
          name="data"
          defaultValue={data}
          aria-label="Ir para a data"
          className="rounded-full border border-areia-300 bg-white px-3 py-1.5 text-sm text-verde-900"
        />
        <button className={classeBotaoSecundario}>Ir</button>
      </form>
    </div>
  );

  const doDia = locacoes.filter((l) => l.data === data);

  return (
    <>
      <Cabecalho
        titulo="Locação de quadras"
        subtitulo={
          semana
            ? `Semana da ${quadraSel.nome} (${moeda(quadraSel.valor_hora)}/hora). Clique num horário livre para reservar.`
            : `${formatarDataLonga(data)}. Clique num horário livre para reservar.`
        }
        acoes={
          <Link href={`/admin/locacoes/nova?data=${data}`} className={classeBotao}>
            Nova locação
          </Link>
        }
      />

      {pedidos > 0 && (
        <Link
          href="/admin/locacoes/reservas?status=solicitada"
          className="mb-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-sol-500 bg-sol-400/15 px-4 py-3 text-sm font-semibold text-verde-900 hover:bg-sol-400/25"
        >
          <span>
            {pedidos === 1 ? "1 pedido de aluno aguardando" : `${pedidos} pedidos de alunos aguardando`} confirmação
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-areia-200 bg-white p-1 text-sm font-semibold">
            <Link
              href={`/admin/locacoes?data=${data}`}
              className={`rounded-full px-4 py-1 ${!semana ? "bg-verde-700 text-white" : "text-verde-800"}`}
            >
              Dia
            </Link>
            <Link
              href={`/admin/locacoes?data=${data}&visao=semana&quadra=${quadraSel.id}`}
              className={`rounded-full px-4 py-1 ${semana ? "bg-verde-700 text-white" : "text-verde-800"}`}
            >
              Semana
            </Link>
          </div>
          {semana && (
            <div className="flex flex-wrap gap-1">
              {quadras.map((q) => (
                <Link
                  key={q.id}
                  href={`/admin/locacoes?data=${data}&visao=semana&quadra=${q.id}`}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    q.id === quadraSel.id ? "bg-sol-400 text-verde-900" : "text-verde-800 hover:bg-areia-100"
                  }`}
                >
                  {q.nome}
                </Link>
              ))}
            </div>
          )}
        </div>
        {navegacao}
      </div>

      <Legenda />

      {semana ? (
        <Grade
          colunas={diasDaSemana(de).map((d) => ({
            chave: d,
            destaque: d === dia,
            titulo: (
              <Link href={`/admin/locacoes?data=${d}`} className="hover:underline">
                {DIAS_SEMANA[diaSemanaIso(d)].curto} {formatarData(d)}
              </Link>
            ),
          }))}
          celula={(d, h) => <Celula ctx={ctx} data={d} quadraId={quadraSel.id} h={h} />}
        />
      ) : (
        <Grade
          colunas={quadras.map((q) => ({
            chave: q.id,
            titulo: (
              <>
                {q.nome}
                <span className="block text-[11px] font-semibold opacity-70">{moeda(q.valor_hora)}/h</span>
              </>
            ),
          }))}
          celula={(qid, h) => <Celula ctx={ctx} data={data} quadraId={qid} h={h} />}
        />
      )}

      {!semana && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-xl font-bold text-verde-900">Locações do dia</h2>
          {doDia.length === 0 ? (
            <Vazio>Nenhuma locação neste dia.</Vazio>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {doDia.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/admin/locacoes/${l.id}`}
                    className="flex flex-col gap-2 rounded-3xl border border-areia-200 bg-white p-4 shadow-sm transition hover:border-verde-600"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-verde-900">{l.cliente}</p>
                        <p className="text-sm text-tinta-suave">
                          {l.quadra} · {horaMin(l.ini)} às {horaMin(l.fim)}
                        </p>
                      </div>
                      <SeloStatusLocacao status={l.status} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-verde-900">{moeda(l.total)}</span>
                      <SeloPagamento situacao={l.pagamento} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
