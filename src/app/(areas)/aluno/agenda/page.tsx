import type { Metadata } from "next";
import { CartaoAula } from "@/components/agenda/cartao-aula";
import { Cabecalho, Cartao, Etiqueta, Vazio } from "@/components/agenda/ui";
import { listarAulas, listarTurmas, turmasDoAluno } from "@/lib/agenda/consultas";
import { agora, DIAS_SEMANA, diaSemanaIso, faixaHorario, formatarData, formatarHora, HORAS_ANTECEDENCIA_DESMARCAR, hoje, horaMenos, prazoDesmarcar, somarDias } from "@/lib/agenda/datas";
import { rotuloPresenca, type StatusPresenca } from "@/lib/agenda/tipos";
import { getSessao } from "@/lib/sessao";
import { BotaoDesmarcar } from "./botao-desmarcar";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "Minha agenda" };

type Presenca = {
  id: string;
  status: StatusPresenca;
  aula: { data: string; turma: { nome: string } | null } | null;
};

const corPresenca: Record<StatusPresenca, string> = {
  presente: "text-verde-700",
  falta: "text-erro",
  falta_justificada: "text-sol-500",
};

export default async function MinhaAgendaPage() {
  const { perfil } = await getSessao();
  if (!perfil) return null;
  const dia = hoje();
  const supabase = await createClient();

  const turmaIds = await turmasDoAluno(perfil.id);
  const [turmas, aulas, presencasRes] = await Promise.all([
    listarTurmas({ ids: turmaIds }),
    turmaIds.length ? listarAulas({ de: dia, ate: somarDias(dia, 28), turmaIds }) : Promise.resolve([]),
    supabase
      .from("presencas")
      .select("id, status, aula:aulas(data, turma:turmas(nome))")
      .eq("aluno_id", perfil.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const presencas = ((presencasRes.data ?? []) as unknown as Presenca[]).sort((a, b) =>
    (b.aula?.data ?? "").localeCompare(a.aula?.data ?? ""),
  );
  const presentes = presencas.filter((p) => p.status === "presente").length;

  // Minhas marcações nas próximas aulas (desmarcadas por mim ficam como falta justificada).
  const { data: futuras } = aulas.length
    ? await supabase.from("presencas").select("aula_id, status, observacao").eq("aluno_id", perfil.id).in("aula_id", aulas.map((a) => a.id))
    : { data: [] };
  const marcacao = new Map(((futuras ?? []) as { aula_id: string; status: string; observacao: string | null }[]).map((p) => [p.aula_id, p]));
  const instante = agora();

  return (
    <>
      <Cabecalho titulo="Minha agenda" subtitulo="Seus horários fixos, as próximas aulas e sua frequência." />

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-semibold text-verde-900">Meus horários</h2>
        {turmas.length === 0 ? (
          <Vazio>Você ainda não está matriculado em nenhuma turma.</Vazio>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {turmas.map((t) => (
              <Cartao key={t.id}>
                <p className="text-xs font-bold uppercase tracking-wide text-sol-500">
                  Toda {DIAS_SEMANA[t.dia_semana].longo.toLowerCase()}
                </p>
                <p className="font-display text-2xl font-semibold text-verde-900">{faixaHorario(t.hora_inicio, t.hora_fim)}</p>
                <p className="font-semibold text-tinta">{t.nome}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.modalidade && <Etiqueta>{t.modalidade.nome}</Etiqueta>}
                  {t.nivel && <Etiqueta>{t.nivel.nome}</Etiqueta>}
                  {t.quadra && <Etiqueta>{t.quadra.nome}</Etiqueta>}
                </div>
                {t.professor && <p className="mt-2 text-xs text-tinta-suave">Prof. {t.professor.nome}</p>}
              </Cartao>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-verde-900">Próximas 4 semanas</h2>
          {aulas.length === 0 ? (
            <Vazio>Nenhuma aula marcada.</Vazio>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {aulas.map((a) => (
                <div key={a.id}>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-sol-500">
                    {a.data === dia ? "Hoje" : `${DIAS_SEMANA[diaSemanaIso(a.data)].curto} ${formatarData(a.data)}`}
                  </p>
                  <CartaoAula aula={a} />
                  {(() => {
                    const m = marcacao.get(a.id);
                    const desmarcada = m?.observacao === "Desmarcada pelo aluno";
                    const prazo = prazoDesmarcar(a.data, a.turma?.hora_inicio ?? "00:00:00");
                    const podeMexer = a.status === "agendada" && prazo.getTime() > instante && (!m || desmarcada);
                    return (
                      <div className="mt-2 flex flex-col gap-1">
                        {desmarcada && (
                          <p className="rounded-2xl bg-sol-400/20 px-3 py-1.5 text-center text-xs font-bold text-verde-900">
                            Você desmarcou esta aula
                          </p>
                        )}
                        {podeMexer && (
                          <BotaoDesmarcar
                            aulaId={a.id}
                            desmarcada={desmarcada}
                            prazo={`${formatarData(a.data)} às ${formatarHora(horaMenos(a.turma?.hora_inicio ?? "00:00:00", HORAS_ANTECEDENCIA_DESMARCAR))}`}
                          />
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-tinta-suave">
            Não vai conseguir ir? Desmarque até 2 horas antes do início. A vaga fica livre para reposição de outro aluno e
            conta como falta justificada.
          </p>
        </section>

        <aside>
          <h2 className="mb-3 font-display text-xl font-semibold text-verde-900">Frequência</h2>
          <Cartao>
            {presencas.length === 0 ? (
              <p className="text-sm text-tinta-suave">Nenhuma chamada registrada ainda.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-tinta-suave">
                  <strong className="font-display text-2xl text-verde-900">
                    {Math.round((presentes / presencas.length) * 100)}%
                  </strong>{" "}
                  de presença nas últimas {presencas.length} aulas
                </p>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {presencas.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2 border-t border-areia-100 pt-1.5">
                      <span>
                        {p.aula ? formatarData(p.aula.data) : "—"}{" "}
                        <span className="text-tinta-suave">{p.aula?.turma?.nome}</span>
                      </span>
                      <span className={`font-semibold ${corPresenca[p.status]}`}>{rotuloPresenca[p.status]}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Cartao>
        </aside>
      </div>
    </>
  );
}
