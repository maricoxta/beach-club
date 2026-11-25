import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho, Cartao, Etiqueta, Vazio } from "@/components/agenda/ui";
import { DIAS_SEMANA, diaSemanaIso, faixaHorario, formatarData, formatarDataHora, hoje } from "@/lib/agenda/datas";
import { createClient } from "@/lib/supabase/server";
import { BotaoReservar } from "../agenda/botao-desmarcar";
import { MarcarLidos } from "./marcar-lidos";

export const instant = false;
export const metadata: Metadata = { title: "Avisos" };

type AvisoVaga = {
  aula_id: string;
  liberado_em: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  turma: string;
  modalidade: string;
  nivel: string;
  quadra: string | null;
  professor: string | null;
  vagas_disponiveis: number;
  lido: boolean;
  situacao: "disponivel" | "esgotada" | "reservada" | "sem_credito";
};

export default async function AvisosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("meus_avisos");
  if (error) console.error("[agenda] meus_avisos:", error.code, error.message);
  const avisos = (data ?? []) as AvisoVaga[];
  const dia = hoje();

  return (
    <>
      <MarcarLidos ativo={avisos.some((a) => !a.lido)} />
      <Cabecalho
        titulo="Avisos"
        subtitulo="Vagas liberadas pela recepção em outras turmas da sua modalidade e nível. Quem reservar primeiro fica com a vaga."
        acoes={
          <Link href="/aluno/reposicao" className="text-sm font-semibold text-verde-700 hover:underline">
            Meus créditos e aulas extras →
          </Link>
        }
      />
      {error ? (
        <Vazio>Não foi possível carregar os avisos. Tente de novo em instantes.</Vazio>
      ) : avisos.length === 0 ? (
        <Vazio>Nenhuma vaga liberada por enquanto. Quando a recepção abrir uma vaga na sua modalidade e nível, ela aparece aqui.</Vazio>
      ) : (
        <div className="flex flex-col gap-3">
          {avisos.map((a) => (
            <Cartao key={a.aula_id} className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${!a.lido && a.situacao === "disponivel" ? "border-sol-400 ring-2 ring-sol-400/30" : ""}`}>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {!a.lido && <span className="rounded-full bg-sol-400 px-2 py-0.5 text-[11px] font-bold uppercase text-verde-900">Novo</span>}
                  <span className="text-xs text-tinta-suave">Liberada {formatarDataHora(a.liberado_em)}</span>
                </div>
                <p className="font-semibold text-tinta">
                  Vaga disponível na turma <span className="text-verde-900">{a.turma}</span>
                  {a.professor && <> com o professor <span className="text-verde-900">{a.professor}</span></>}
                </p>
                <p className="font-display text-lg font-semibold text-verde-900">
                  {a.data === dia ? "Hoje" : `${DIAS_SEMANA[diaSemanaIso(a.data)].longo}, ${formatarData(a.data)}`} · {faixaHorario(a.hora_inicio, a.hora_fim)}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Etiqueta>{a.modalidade}</Etiqueta>
                  <Etiqueta>{a.nivel}</Etiqueta>
                  {a.quadra && <Etiqueta>{a.quadra}</Etiqueta>}
                </div>
              </div>
              <div className="sm:w-52 sm:shrink-0">
                {a.situacao === "disponivel" ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-center text-xs font-bold text-verde-700">
                      {a.vagas_disponiveis} vaga{a.vagas_disponiveis === 1 ? "" : "s"} restante{a.vagas_disponiveis === 1 ? "" : "s"}
                    </p>
                    <BotaoReservar aulaId={a.aula_id} rotulo="Marcar aula" />
                  </div>
                ) : a.situacao === "reservada" ? (
                  <p className="rounded-2xl bg-verde-50 px-3 py-2 text-center text-sm font-bold text-verde-700">Você está nesta aula ✓</p>
                ) : a.situacao === "esgotada" ? (
                  <p className="rounded-2xl bg-areia-100 px-3 py-2 text-center text-sm font-semibold text-tinta-suave">Esgotada: outro aluno pegou a vaga</p>
                ) : (
                  <p className="rounded-2xl bg-areia-100 px-3 py-2 text-center text-xs font-semibold text-tinta-suave">
                    Você não tem aula extra nem crédito de reposição para esta semana.
                  </p>
                )}
              </div>
            </Cartao>
          ))}
        </div>
      )}
    </>
  );
}
