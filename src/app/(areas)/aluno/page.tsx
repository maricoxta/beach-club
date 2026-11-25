import type { Metadata } from "next";
import Link from "next/link";
import { CartaoAula } from "@/components/agenda/cartao-aula";
import { CartaoModulo, TituloArea } from "@/components/area-shell";
import { Vazio } from "@/components/agenda/ui";
import { listarAulas, turmasDoAluno } from "@/lib/agenda/consultas";
import { DIAS_SEMANA, diaSemanaIso, faixaHorario, formatarData, hoje, somarDias } from "@/lib/agenda/datas";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { Cartao } from "@/components/agenda/ui";
import { Estrelas } from "@/components/agenda/avaliacoes";
import { avaliarAula } from "./agenda/acoes";
import { FormAvaliarAula } from "./form-avaliar-aula";

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
  const [{ data: naoLidos }, { data: paraAvaliarRes }, { data: minhasRes }] = await Promise.all([
    supabase.rpc("contar_avisos_nao_lidos"),
    supabase.rpc("aulas_para_avaliar"),
    // O RLS devolve só as avaliações do próprio aluno.
    supabase
      .from("avaliacoes_aluno")
      .select("id, modalidade_id, mes, nota, comentario, professor:perfis!professor_id(nome), nivel:niveis(nome), modalidade:modalidades(nome)")
      .order("mes", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);
  type MinhaAvaliacao = {
    id: string;
    modalidade_id: string;
    mes: string;
    nota: number;
    comentario: string;
    professor: { nome: string } | null;
    nivel: { nome: string } | null;
    modalidade: { nome: string } | null;
  };
  // Última avaliação em cada modalidade.
  const minhas = ((minhasRes ?? []) as unknown as MinhaAvaliacao[]).filter(
    (a, i, todas) => todas.findIndex((b) => b.modalidade_id === a.modalidade_id) === i,
  );
  const paraAvaliar = (paraAvaliarRes ?? []) as { aula_id: string; data: string; hora_inicio: string; hora_fim: string; turma: string; professor: string | null }[];

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

      {paraAvaliar.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold text-verde-900">Como foi a aula?</h2>
          <p className="mb-3 text-sm text-tinta-suave">Sua avaliação é anônima: o professor vê a nota e o comentário, mas não quem enviou.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paraAvaliar.slice(0, 3).map((a) => (
              <Cartao key={a.aula_id} className="flex flex-col gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-sol-500">
                  {DIAS_SEMANA[diaSemanaIso(a.data)].curto} {formatarData(a.data)} · {faixaHorario(a.hora_inicio, a.hora_fim)}
                </p>
                <p className="font-semibold text-tinta">
                  {a.turma}
                  {a.professor && <span className="font-normal text-tinta-suave"> · Prof. {a.professor}</span>}
                </p>
                <FormAvaliarAula acao={avaliarAula.bind(null, a.aula_id)} />
              </Cartao>
            ))}
          </div>
        </section>
      )}

      {minhas.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold text-verde-900">Sua avaliação do professor</h2>
          <p className="mb-3 text-sm text-tinta-suave">Todo mês o professor avalia seu desempenho no nível atual. Com 5 estrelas você pode subir de nível.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {minhas.map((a) => (
              <Cartao key={a.id} className="flex flex-col gap-1">
                <p className="text-xs font-bold uppercase tracking-wide text-sol-500">
                  {a.modalidade?.nome} · {a.nivel?.nome} · {formatarData(a.mes, { month: "long", year: "numeric" })}
                </p>
                <p className="text-2xl">
                  <Estrelas nota={a.nota} />
                </p>
                {a.nota === 5 && <p className="text-sm font-bold text-verde-700">Parabéns! Você está apto a subir de nível. Fale com a recepção.</p>}
                <p className="text-sm text-tinta">“{a.comentario}”</p>
                {a.professor && <p className="text-xs text-tinta-suave">Prof. {a.professor.nome}</p>}
              </Cartao>
            ))}
          </div>
        </section>
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
