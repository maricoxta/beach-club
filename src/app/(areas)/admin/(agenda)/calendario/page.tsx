import type { Metadata } from "next";
import Link from "next/link";
import { CalendarioMes, type Contagem } from "@/components/agenda/calendario-mes";
import { Cabecalho, classeBotaoSecundario } from "@/components/agenda/ui";
import { hoje, inicioDaSemana, somarDias } from "@/lib/agenda/datas";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "Calendário" };


const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function somarMeses(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}


export default async function CalendarioPage({ searchParams }: PageProps<"/admin/calendario">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const dia = hoje();
  const mes = typeof sp.mes === "string" && RE_MES.test(sp.mes) ? sp.mes : dia.slice(0, 7);

  // Grade de segunda a domingo cobrindo o mês inteiro.
  const primeiro = `${mes}-01`;
  const ultimo = somarDias(`${somarMeses(mes, 1)}-01`, -1);
  const inicio = inicioDaSemana(primeiro);
  const fim = somarDias(inicioDaSemana(ultimo), 6);
  const semanas: string[][] = [];
  for (let s = inicio; s <= fim; s = somarDias(s, 7)) semanas.push(Array.from({ length: 7 }, (_, i) => somarDias(s, i)));

  const { data, error } = await supabase
    .from("aulas")
    .select("data, status, turma:turmas(modalidade:modalidades(nome))")
    .gte("data", inicio)
    .lte("data", fim);
  if (error) throw new Error("Não foi possível carregar o calendário.");

  const porDia = new Map<string, Contagem>();
  for (const a of (data ?? []) as unknown as { data: string; status: string; turma: { modalidade: { nome: string } | null } | null }[]) {
    const c = porDia.get(a.data) ?? { total: 0, canceladas: 0, realizadas: 0, modalidades: new Set<string>() };
    c.total++;
    if (a.status === "cancelada") c.canceladas++;
    if (a.status === "realizada") c.realizadas++;
    if (a.turma?.modalidade) c.modalidades.add(a.turma.modalidade.nome);
    porDia.set(a.data, c);
  }

  const nomeMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${primeiro}T00:00:00Z`),
  );

  return (
    <>
      <Cabecalho
        titulo="Calendário"
        subtitulo="Escolha uma semana para abrir a agenda dela."
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <Link className={classeBotaoSecundario} href={`/admin/calendario?mes=${somarMeses(mes, -1)}`} aria-label="Mês anterior">
              ←
            </Link>
            <span className="min-w-40 text-center font-display font-semibold capitalize text-verde-900">{nomeMes}</span>
            <Link className={classeBotaoSecundario} href={`/admin/calendario?mes=${somarMeses(mes, 1)}`} aria-label="Próximo mês">
              →
            </Link>
            {mes !== dia.slice(0, 7) && (
              <Link className={classeBotaoSecundario} href="/admin/calendario">
                Hoje
              </Link>
            )}
          </div>
        }
      />

      <CalendarioMes mes={mes} hoje={dia} semanas={semanas} porDia={porDia} />
    </>
  );
}
