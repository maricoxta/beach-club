import Link from "next/link";
import { BotaoExcluir } from "@/components/frequencia/botao-excluir";
import { IconeAtividade } from "@/components/frequencia/icone-atividade";
import { Alerta, classeBotao, classeBotaoPerigo } from "@/components/ui";
import { formatarDataLonga } from "@/lib/agenda/datas";
import {
  INFO_TIPO,
  formatarDuracao,
  formatarKm,
  formatarNumero,
  rotuloMes,
  somarMeses,
  type AtividadeComFoto,
  type Resumo,
} from "@/lib/frequencia";
import { excluirCheckin } from "@/lib/frequencia-acoes";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Props = {
  nome: string;
  resumo: Resumo;
  atividades: AtividadeComFoto[];
  grade: string[][];
  mes: string;
  dia: string | null;
  hoje: string;
  // Rota base da página (ex.: /aluno/frequencia). Os links mudam só ?mes= e ?dia=.
  base: string;
  // Aluno dono: mostra "Novo check-in" e excluir. Staff só visualiza.
  editavel: boolean;
  salvo?: boolean;
};

export function PainelFrequencia({ nome, resumo, atividades, grade, mes, dia, hoje, base, editavel, salvo }: Props) {
  const porDia = new Map<string, AtividadeComFoto[]>();
  for (const a of atividades) porDia.set(a.data, [...(porDia.get(a.data) ?? []), a]);

  const doMes = atividades.filter((a) => a.data.startsWith(mes));
  const totalMes = {
    checkins: doMes.length,
    dias: new Set(doMes.map((a) => a.data)).size,
    duracao: doMes.reduce((s, a) => s + (a.duracao_min ?? 0), 0),
    km: doMes.reduce((s, a) => s + (a.distancia_km ?? 0), 0),
    calorias: doMes.reduce((s, a) => s + (a.calorias ?? 0), 0),
    passos: doMes.reduce((s, a) => s + (a.passos ?? 0), 0),
  };

  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const href = (q: { mes?: string; dia?: string }) => {
    const p = new URLSearchParams();
    if (q.mes) p.set("mes", q.mes);
    if (q.dia) p.set("dia", q.dia);
    return `${base}?${p.toString()}`;
  };
  const novoHref = `${base}/novo${dia ? `?dia=${dia}` : ""}`;
  const doDia = dia ? (porDia.get(dia) ?? []) : [];
  const mesFuturo = mes > hoje.slice(0, 7);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* Cabeçalho com totais gerais */}
      <section className="overflow-hidden rounded-3xl border border-areia-200 bg-white shadow-sm">
        <div className="duna h-16 bg-verde-50" aria-hidden />
        <div className="-mt-10 flex flex-col items-center px-5 pb-6 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-verde-700 font-display text-2xl font-bold text-white shadow">
            {iniciais}
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold text-verde-900 sm:text-3xl">{nome}</h1>
          <p className="text-sm text-tinta-suave">Calendário de frequência</p>
          <dl className="mt-5 grid w-full max-w-md grid-cols-3 gap-2">
            <Numero valor={formatarNumero(resumo.checkins)} rotulo="Check-ins" />
            <Numero valor={formatarNumero(resumo.dias_ativos)} rotulo="Dias ativos" />
            <Numero valor={formatarDuracao(resumo.duracao_min)} rotulo="Tempo total" />
          </dl>
          {editavel && (
            <Link href={novoHref} className={`${classeBotao} mt-6 inline-flex items-center gap-2`}>
              <span className="text-lg leading-none">+</span> Novo check-in
            </Link>
          )}
        </div>
      </section>

      {salvo && <Alerta tipo="ok">Check-in registrado! Bora pra próxima.</Alerta>}

      {/* Calendário do mês */}
      <section className="rounded-3xl border border-areia-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            href={href({ mes: somarMeses(mes, -1) })}
            className="grid h-9 w-9 place-items-center rounded-full border border-areia-200 text-verde-800 hover:bg-verde-50"
            aria-label="Mês anterior"
          >
            ‹
          </Link>
          <h2 className="font-display text-xl font-bold text-verde-900">{rotuloMes(mes)}</h2>
          {mesFuturo ? (
            <span className="h-9 w-9" />
          ) : (
            <Link
              href={href({ mes: somarMeses(mes, 1) })}
              className="grid h-9 w-9 place-items-center rounded-full border border-areia-200 text-verde-800 hover:bg-verde-50"
              aria-label="Próximo mês"
            >
              ›
            </Link>
          )}
        </div>

        <div className="grid grid-cols-7 pb-2 text-center text-xs font-bold uppercase tracking-wide text-tinta-suave">
          {SEMANA.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 rounded-2xl bg-areia-50 p-1.5 sm:gap-2 sm:p-2">
          {grade.flat().map((d) => {
            const lista = porDia.get(d) ?? [];
            const fora = !d.startsWith(mes);
            const futuro = d > hoje;
            const selecionado = d === dia;
            const conteudo = <Dia data={d} lista={lista} ehHoje={d === hoje} />;
            const classe = `relative grid aspect-square place-items-center rounded-full transition ${
              selecionado ? "ring-2 ring-sol-400 ring-offset-2 ring-offset-areia-50" : ""
            }`;
            if (fora) return <span key={d} className="aspect-square" aria-hidden />;
            if (futuro)
              return (
                <span key={d} className={`${classe} text-tinta-suave/40`}>
                  <span className="text-sm font-semibold sm:text-base">{Number(d.slice(8))}</span>
                </span>
              );
            return (
              <Link
                key={d}
                href={href({ mes, dia: d })}
                scroll={false}
                className={`${classe} hover:bg-white`}
                aria-label={`${formatarDataLonga(d)}: ${lista.length ? `${lista.length} atividade(s)` : "sem atividade"}`}
              >
                {conteudo}
              </Link>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-tinta-suave">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-verde-700" /> Aula
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-sol-400" /> Play
          </span>
          <span>Toque num dia para ver os detalhes</span>
        </div>

        {/* Totais do mês */}
        <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-areia-100 pt-4 sm:grid-cols-4">
          <Mini rotulo="No mês" valor={`${totalMes.checkins} check-in${totalMes.checkins === 1 ? "" : "s"}`} extra={`${totalMes.dias} dia${totalMes.dias === 1 ? "" : "s"} · ${formatarDuracao(totalMes.duracao)}`} />
          <Mini rotulo="Distância" valor={formatarKm(totalMes.km)} />
          <Mini rotulo="Calorias" valor={`${formatarNumero(totalMes.calorias)} kcal`} />
          <Mini rotulo="Passos" valor={formatarNumero(totalMes.passos)} />
        </dl>
      </section>

      {/* Detalhe do dia escolhido */}
      {dia && (
        <section id="dia" className="rounded-3xl border border-areia-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold capitalize text-verde-900">{formatarDataLonga(dia)}</h2>
            {editavel && (
              <Link href={novoHref} className="text-sm font-bold text-verde-700 hover:underline">
                + Registrar {doDia.length ? "outra" : "atividade"}
              </Link>
            )}
          </div>
          {doDia.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-areia-200 px-4 py-6 text-center text-sm text-tinta-suave">
              Nenhuma atividade neste dia.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {doDia.map((a) => (
                <CartaoAtividade key={a.id} atividade={a} editavel={editavel} dia={dia} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs font-semibold text-tinta-suave sm:text-sm">{rotulo}</dt>
      <dd className="font-display text-xl font-bold text-verde-900 sm:text-2xl">{valor}</dd>
    </div>
  );
}

function Mini({ rotulo, valor, extra }: { rotulo: string; valor: string; extra?: string }) {
  return (
    <div className="rounded-2xl bg-areia-50 px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-sol-500">{rotulo}</dt>
      <dd className="font-display text-base font-bold text-verde-900">{valor}</dd>
      {extra && <dd className="text-xs text-tinta-suave">{extra}</dd>}
    </div>
  );
}

// Célula do calendário: foto (se houver) ou ícone da atividade; com mais de uma
// atividade, um selinho com o ícone de outra e a contagem.
function Dia({ data, lista, ehHoje }: { data: string; lista: AtividadeComFoto[]; ehHoje: boolean }) {
  const numero = Number(data.slice(8));
  if (!lista.length) {
    return (
      <span
        className={`grid h-[78%] w-[78%] place-items-center rounded-full text-sm font-semibold sm:text-base ${
          ehHoje ? "bg-verde-700 text-white" : "text-verde-900"
        }`}
      >
        {numero}
      </span>
    );
  }
  const comFoto = lista.find((a) => a.fotoUrl);
  const principal = comFoto ?? lista[0];
  const outra = lista.find((a) => a !== principal);
  const selo = comFoto ? (outra ?? principal) : outra;
  return (
    <>
      {comFoto?.fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária do Storage
        <img src={comFoto.fotoUrl} alt="" className="h-[86%] w-[86%] rounded-full object-cover shadow-sm" loading="lazy" />
      ) : (
        <IconeAtividade tipo={principal.tipo} className="h-[86%] w-[86%] shadow-sm" />
      )}
      {selo && (
        <IconeAtividade tipo={selo.tipo} className="absolute -left-0.5 -top-0.5 h-[42%] w-[42%] ring-2 ring-white" />
      )}
      {lista.length > 1 && (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-verde-900 px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {lista.length}
        </span>
      )}
      <span className="sr-only">{numero}</span>
    </>
  );
}

function CartaoAtividade({ atividade: a, editavel, dia }: { atividade: AtividadeComFoto; editavel: boolean; dia: string }) {
  const info = INFO_TIPO[a.tipo];
  const metricas = [
    a.duracao_min ? { r: "Tempo", v: formatarDuracao(a.duracao_min) } : null,
    a.distancia_km !== null ? { r: "Distância", v: formatarKm(a.distancia_km) } : null,
    a.calorias !== null ? { r: "Calorias", v: `${formatarNumero(a.calorias)} kcal` } : null,
    a.passos !== null ? { r: "Passos", v: formatarNumero(a.passos) } : null,
  ].filter((m): m is { r: string; v: string } => Boolean(m));
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-areia-200 bg-areia-50 p-4 sm:flex-row">
      {a.fotoUrl && (
        <a href={a.fotoUrl} target="_blank" rel="noreferrer" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária do Storage */}
          <img src={a.fotoUrl} alt={`Foto: ${info.rotulo}`} className="h-40 w-full rounded-2xl object-cover sm:h-28 sm:w-28" />
        </a>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <IconeAtividade tipo={a.tipo} className="h-9 w-9" />
          <div>
            <p className="font-bold text-verde-900">{info.rotulo}</p>
            <p className="text-xs font-semibold text-tinta-suave">{info.aula ? "Aula" : "Jogo livre"}</p>
          </div>
        </div>
        {metricas.length > 0 && (
          <dl className="mt-3 flex flex-wrap gap-2">
            {metricas.map((m) => (
              <div key={m.r} className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-areia-200">
                <dt className="inline font-semibold text-tinta-suave">{m.r}: </dt>
                <dd className="inline font-bold text-verde-900">{m.v}</dd>
              </div>
            ))}
          </dl>
        )}
        {a.observacao && <p className="mt-2 text-sm text-tinta-suave">{a.observacao}</p>}
      </div>
      {editavel && (
        <BotaoExcluir acao={excluirCheckin} id={a.id} dia={dia} classe={`${classeBotaoPerigo} self-start px-3 py-1 text-xs`} />
      )}
    </li>
  );
}
