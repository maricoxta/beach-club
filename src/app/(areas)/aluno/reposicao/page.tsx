import type { Metadata } from "next";
import { Cabecalho, Cartao, Etiqueta, LinkVoltar, Vazio } from "@/components/agenda/ui";
import { DIAS_SEMANA, diaSemanaIso, faixaHorario, formatarData, hoje, inicioDaSemana, somarDias } from "@/lib/agenda/datas";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { BotaoReservar } from "../agenda/botao-desmarcar";

export const instant = false;
export const metadata: Metadata = { title: "Reposição e aula extra" };

type Vaga = {
  aula_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  turma: string;
  modalidade: string;
  nivel: string;
  quadra: string | null;
  professor: string | null;
  vagas_livres: number;
  usa_extra: boolean;
};
type Credito = { aula_desmarcada_id: string; data: string; turma: string; modalidade: string; valido_ate: string };

export default async function ReposicaoPage() {
  const { perfil } = await getSessao();
  if (!perfil) return null;
  const dia = hoje();
  const supabase = await createClient();

  const [vagasRes, creditosRes, planosRes, extrasRes] = await Promise.all([
    supabase.rpc("vagas_para_reposicao", { p_de: dia, p_ate: somarDias(dia, 21) }),
    supabase.rpc("meus_creditos_reposicao"),
    supabase.from("matriculas").select("plano:planos(nome, aulas_extras_semana)").eq("aluno_id", perfil.id).eq("status", "ativa"),
    supabase.from("reposicoes").select("tipo, aula:aulas(data)").eq("aluno_id", perfil.id).eq("tipo", "extra"),
  ]);
  for (const r of [vagasRes, creditosRes]) if (r.error) console.error("[agenda] reposicao:", r.error.code, r.error.message);
  const vagas = (vagasRes.data ?? []) as Vaga[];
  const creditos = (creditosRes.data ?? []) as Credito[];
  const extrasPorSemana = Math.max(
    0,
    ...((planosRes.data ?? []) as unknown as { plano: { aulas_extras_semana: number } | null }[]).map((m) => m.plano?.aulas_extras_semana ?? 0),
  );
  const semana = inicioDaSemana(dia);
  const extrasUsadas = ((extrasRes.data ?? []) as unknown as { aula: { data: string } | null }[]).filter(
    (r) => r.aula && inicioDaSemana(r.aula.data) === semana,
  ).length;

  const porData = new Map<string, Vaga[]>();
  for (const v of vagas) porData.set(v.data, [...(porData.get(v.data) ?? []), v]);

  return (
    <>
      <LinkVoltar href="/aluno/agenda">Minha agenda</LinkVoltar>
      <Cabecalho
        titulo="Reposição e aula extra"
        subtitulo="Vagas liberadas pela recepção em outras turmas da sua modalidade e nível, nas próximas 3 semanas. Reserve até 2 horas antes; quem reservar primeiro fica com a vaga."
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <Cartao>
          <p className="text-xs font-bold uppercase tracking-wide text-sol-500">Aula extra do plano</p>
          {extrasPorSemana > 0 ? (
            <>
              <p className="font-display text-2xl font-semibold text-verde-900">
                {Math.max(0, extrasPorSemana - extrasUsadas)} de {extrasPorSemana} livre{extrasPorSemana > 1 ? "s" : ""} nesta semana
              </p>
              <p className="text-sm text-tinta-suave">Seu plano dá direito a {extrasPorSemana} aula(s) extra(s) por semana (seg a dom). Não acumula.</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-tinta-suave">Seu plano não inclui aula extra. Os planos 2x por semana dão direito a 1 por semana.</p>
          )}
        </Cartao>
        <Cartao>
          <p className="text-xs font-bold uppercase tracking-wide text-sol-500">Créditos de reposição</p>
          <p className="font-display text-2xl font-semibold text-verde-900">
            {creditos.length} crédito{creditos.length === 1 ? "" : "s"}
          </p>
          {creditos.length === 0 ? (
            <p className="text-sm text-tinta-suave">Desmarque uma aula até 2h antes para ganhar um crédito de reposição.</p>
          ) : (
            <ul className="mt-1 text-sm text-tinta-suave">
              {creditos.map((c) => (
                <li key={c.aula_desmarcada_id}>
                  {c.modalidade}: aula de {formatarData(c.data)} desmarcada, use até {formatarData(c.valido_ate)}
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      {vagas.length === 0 ? (
        <Vazio>
          {extrasPorSemana > 0 || creditos.length > 0
            ? "Nenhuma vaga liberada por enquanto. Quando a recepção abrir uma vaga na sua modalidade e nível, você recebe um aviso no app."
            : "Você não tem aula extra nem crédito de reposição no momento."}
        </Vazio>
      ) : (
        <div className="flex flex-col gap-6">
          {[...porData.entries()].map(([data, lista]) => (
            <section key={data}>
              <h2 className="mb-2 font-display text-lg font-semibold text-verde-900">
                {data === dia ? "Hoje" : `${DIAS_SEMANA[diaSemanaIso(data)].longo}, ${formatarData(data)}`}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {lista.map((v) => (
                  <Cartao key={v.aula_id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-lg font-semibold text-verde-900">{faixaHorario(v.hora_inicio, v.hora_fim)}</span>
                      <span className="rounded-full bg-verde-50 px-2.5 py-0.5 text-xs font-bold text-verde-700">
                        {v.vagas_livres} vaga{v.vagas_livres === 1 ? "" : "s"} liberada{v.vagas_livres === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="font-semibold text-tinta">{v.turma}</p>
                    <div className="flex flex-wrap gap-1">
                      <Etiqueta>{v.modalidade}</Etiqueta>
                      <Etiqueta>{v.nivel}</Etiqueta>
                    </div>
                    <p className="text-xs text-tinta-suave">
                      {v.quadra}
                      {v.professor && ` · ${v.professor}`}
                    </p>
                    <p className="text-xs font-semibold text-sol-500">
                      {v.usa_extra ? "Usa sua aula extra da semana" : "Usa 1 crédito de reposição"}
                    </p>
                    <BotaoReservar aulaId={v.aula_id} />
                  </Cartao>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
