import type { Metadata } from "next";
import Link from "next/link";
import { CartaoAula } from "@/components/agenda/cartao-aula";
import { CartaoModulo, TituloArea } from "@/components/area-shell";
import { Vazio } from "@/components/agenda/ui";
import { listarAulas, turmasDoAluno } from "@/lib/agenda/consultas";
import { DIAS_SEMANA, diaSemanaIso, formatarData, hoje, somarDias } from "@/lib/agenda/datas";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

// Lê a sessão (cookies) a cada request: a rota bloqueia no servidor em vez de ter shell estático.
export const instant = false;

export const metadata: Metadata = { title: "Aluno" };

export default async function AlunoPage() {
  const { perfil } = await getSessao();
  const dia = hoje();
  const turmaIds = perfil ? await turmasDoAluno(perfil.id) : [];
  const aulas = turmaIds.length ? await listarAulas({ de: dia, ate: somarDias(dia, 14), turmaIds }) : [];
  const proximas = aulas.filter((a) => a.status !== "cancelada").slice(0, 3);
  const canceladas = aulas.filter((a) => a.status === "cancelada");
  const supabase = await createClient();
  const { data: naoLidos } = await supabase.rpc("contar_avisos_nao_lidos");

  return (
    <>
      <TituloArea ola={`E aí, ${perfil?.nome.split(" ")[0]}!`} subtitulo="Suas aulas, seu plano e seus pagamentos." />

      {(naoLidos ?? 0) > 0 && (
        <Link
          href="/aluno/avisos"
          className="mb-8 flex items-center justify-between gap-3 rounded-3xl border-2 border-sol-400 bg-sol-400/15 px-5 py-4 transition hover:bg-sol-400/25"
        >
          <span>
            <span className="block font-display text-lg font-semibold text-verde-900">
              {naoLidos === 1 ? "Nova vaga liberada para você!" : `${naoLidos} novas vagas liberadas para você!`}
            </span>
            <span className="text-sm text-tinta-suave">Turmas da sua modalidade e nível. Quem marcar primeiro fica com a vaga.</span>
          </span>
          <span className="shrink-0 rounded-full bg-verde-700 px-4 py-2 text-sm font-bold text-white">Ver vagas</span>
        </Link>
      )}

      <section className="mb-10">
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-verde-900">Próximas aulas</h2>
          <Link href="/aluno/agenda" className="text-sm font-semibold text-verde-700 hover:underline">
            Ver agenda completa →
          </Link>
        </div>
        {turmaIds.length === 0 ? (
          <Vazio>Você ainda não está matriculado em nenhuma turma. Fale com a recepção para escolher seus horários.</Vazio>
        ) : proximas.length === 0 ? (
          <Vazio>Nenhuma aula marcada para os próximos 14 dias.</Vazio>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {proximas.map((a) => (
              <div key={a.id}>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-sol-500">
                  {a.data === dia ? "Hoje" : `${DIAS_SEMANA[diaSemanaIso(a.data)].curto} ${formatarData(a.data)}`}
                </p>
                <CartaoAula aula={a} />
              </div>
            ))}
          </div>
        )}
        {canceladas.length > 0 && (
          <p className="mt-3 rounded-2xl bg-erro/10 px-4 py-2 text-sm font-semibold text-erro">
            Atenção: {canceladas.length === 1 ? "a aula de" : "as aulas de"}{" "}
            {canceladas.map((a) => formatarData(a.data)).join(", ")} {canceladas.length === 1 ? "foi cancelada" : "foram canceladas"}.
          </p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <CartaoModulo
          href="/aluno/frequencia"
          titulo="Calendário de frequência"
          descricao="Registre seus treinos com foto, tempo, distância, calorias e passos."
          destaque="Novo"
        />
        <CartaoModulo href="/aluno/agenda" titulo="Minha agenda" descricao="Seus horários fixos, próximas aulas e presenças." />
        <CartaoModulo href="/aluno/plano" titulo="Plano e pagamentos" descricao="Seu plano, horários e mensalidades." />
      </div>
    </>
  );
}
