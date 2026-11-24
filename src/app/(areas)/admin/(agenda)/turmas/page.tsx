import type { Metadata } from "next";
import Link from "next/link";
import { BarraVagas, Cabecalho, classeBotao, classeBotaoSecundario, Etiqueta, Vazio } from "@/components/agenda/ui";
import { listarTurmas, ocupacaoTurmas } from "@/lib/agenda/consultas";
import { DIAS_SEMANA, faixaHorario } from "@/lib/agenda/datas";

export const instant = false;
export const metadata: Metadata = { title: "Turmas" };

export default async function TurmasPage({ searchParams }: PageProps<"/admin/turmas">) {
  const sp = await searchParams;
  const verInativas = sp.inativas === "1";
  const modalidade = typeof sp.modalidade === "string" ? sp.modalidade : "";

  const [todas, ocupacao] = await Promise.all([listarTurmas(), ocupacaoTurmas()]);
  const modalidades = [...new Map(todas.map((t) => [t.modalidade_id, t.modalidade?.nome ?? ""])).entries()];
  const turmas = todas.filter((t) => (verInativas || t.ativo) && (!modalidade || t.modalidade_id === modalidade));
  const inativas = todas.filter((t) => !t.ativo).length;

  const link = (mudar: Record<string, string>) => {
    const q = new URLSearchParams({ ...(verInativas ? { inativas: "1" } : {}), ...(modalidade ? { modalidade } : {}), ...mudar });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    const s = q.toString();
    return s ? `/admin/turmas?${s}` : "/admin/turmas";
  };

  return (
    <>
      <Cabecalho
        titulo="Turmas"
        subtitulo="Cada turma é um horário semanal fixo. Um aluno de plano 2x se matricula em 2 turmas."
        acoes={
          <Link href="/admin/turmas/nova" className={classeBotao}>
            + Nova turma
          </Link>
        }
      />

      {todas.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <Link href={link({ modalidade: "" })} className={!modalidade ? classeBotao : classeBotaoSecundario}>
            Todas
          </Link>
          {modalidades.map(([id, nome]) => (
            <Link key={id} href={link({ modalidade: id })} className={modalidade === id ? classeBotao : classeBotaoSecundario}>
              {nome}
            </Link>
          ))}
          {inativas > 0 && (
            <Link href={link({ inativas: verInativas ? "" : "1" })} className="ml-auto font-semibold text-verde-700 hover:underline">
              {verInativas ? "Esconder inativas" : `Ver inativas (${inativas})`}
            </Link>
          )}
        </div>
      )}

      {turmas.length === 0 ? (
        <Vazio>
          Nenhuma turma por aqui. Comece cadastrando as <Link className="font-semibold text-verde-700 underline" href="/admin/quadras">quadras</Link> e
          depois crie a primeira turma.
        </Vazio>
      ) : (
        <div className="flex flex-col gap-6">
          {[1, 2, 3, 4, 5, 6, 7].map((dia) => {
            const doDia = turmas.filter((t) => t.dia_semana === dia);
            if (!doDia.length) return null;
            return (
              <section key={dia}>
                <h2 className="mb-2 font-display text-lg font-semibold text-verde-900">{DIAS_SEMANA[dia].longo}</h2>
                <ul className="overflow-hidden rounded-3xl border border-areia-200 bg-white">
                  {doDia.map((t) => (
                    <li key={t.id} className="border-b border-areia-100 last:border-0">
                      <Link
                        href={`/admin/turmas/${t.id}`}
                        className={`grid gap-2 px-4 py-3 transition hover:bg-areia-50 sm:grid-cols-[110px_1fr_auto] sm:items-center ${t.ativo ? "" : "opacity-50"}`}
                      >
                        <span className="font-display font-semibold text-verde-900">{faixaHorario(t.hora_inicio, t.hora_fim)}</span>
                        <div>
                          <p className="font-semibold text-tinta">
                            {t.nome} {!t.ativo && <span className="text-xs font-bold text-erro">(inativa)</span>}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-tinta-suave">
                            {t.modalidade && <Etiqueta>{t.modalidade.nome}</Etiqueta>}
                            {t.nivel && <Etiqueta>{t.nivel.nome}</Etiqueta>}
                            <span className="ml-1">
                              {t.professor?.nome} · {t.quadra?.nome}
                            </span>
                          </div>
                        </div>
                        <BarraVagas ocupadas={ocupacao.get(t.id) ?? 0} vagas={t.vagas} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
