import type { Metadata } from "next";
import Link from "next/link";
import { Selo, Vazio, classeBotao, classeCampo } from "@/components/ui";
import { rotuloPapel, type Papel } from "@/lib/papel";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Alunos" };

const FILTROS = {
  ativos: "Ativos",
  aguardando: "Aguardando aprovação",
  sem_plano: "Sem plano ativo",
  inativos: "Inativos",
  todos: "Todos",
} as const;
type Filtro = keyof typeof FILTROS;

type Aluno = { id: string; nome: string; email: string | null; telefone: string | null; ativo: boolean };
type MatriculaResumo = {
  aluno_id: string;
  status: string;
  planos: { nome: string; aulas_por_semana: number } | null;
  matricula_turmas: { turma_id: string }[];
};

export default async function AlunosPage({ searchParams }: PageProps<"/admin/alunos">) {
  const params = await searchParams;
  const busca = typeof params.q === "string" ? params.q.trim() : "";
  const filtro: Filtro = typeof params.filtro === "string" && params.filtro in FILTROS ? (params.filtro as Filtro) : "ativos";

  const supabase = await createClient();
  let consulta = supabase
    .from("perfis")
    .select("id, nome, email, telefone, ativo")
    .eq("papel", "aluno")
    .order("nome")
    .limit(300);
  if (filtro === "inativos" || filtro === "aguardando") consulta = consulta.eq("ativo", false);
  else if (filtro !== "todos") consulta = consulta.eq("ativo", true);
  // Remove caracteres que têm significado na sintaxe de filtros do PostgREST.
  const termo = busca.replace(/[,()%*\\]/g, " ").trim();
  if (termo) consulta = consulta.or(`nome.ilike.%${termo}%,email.ilike.%${termo}%,telefone.ilike.%${termo}%`);

  const [{ data: perfis }, { data: matriculas }, { data: inativos }] = await Promise.all([
    consulta,
    supabase
      .from("matriculas")
      .select("aluno_id, status, planos(nome, aulas_por_semana), matricula_turmas(turma_id)")
      .in("status", ["ativa", "pausada"]),
    supabase.from("perfis").select("id").eq("papel", "aluno").eq("ativo", false).limit(1000),
  ]);

  // Cadastro feito pelo site nasce inativo: "aguardando" = inativo que nunca teve matrícula.
  const idsInativos = (inativos ?? []).map((p) => p.id as string);
  const comMatricula = new Set<string>();
  if (idsInativos.length > 0) {
    const { data } = await supabase.from("matriculas").select("aluno_id").in("aluno_id", idsInativos);
    for (const m of data ?? []) comMatricula.add(m.aluno_id as string);
  }
  const aguardando = new Set(idsInativos.filter((id) => !comMatricula.has(id)));

  const porAluno = new Map<string, MatriculaResumo[]>();
  for (const m of (matriculas ?? []) as unknown as MatriculaResumo[]) {
    porAluno.set(m.aluno_id, [...(porAluno.get(m.aluno_id) ?? []), m]);
  }
  let alunos = (perfis ?? []) as Aluno[];
  if (filtro === "sem_plano") alunos = alunos.filter((a) => !porAluno.get(a.id)?.some((m) => m.status === "ativa"));
  if (filtro === "aguardando") alunos = alunos.filter((a) => aguardando.has(a.id));

  // Busca sem resultado: avisa se o nome é de alguém da equipe (cada conta tem um papel só).
  let equipe: { nome: string; papel: Papel }[] = [];
  if (alunos.length === 0 && termo) {
    const { data } = await supabase
      .from("perfis")
      .select("nome, papel")
      .neq("papel", "aluno")
      .or(`nome.ilike.%${termo}%,email.ilike.%${termo}%`)
      .limit(5);
    equipe = (data ?? []) as typeof equipe;
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-verde-900">Alunos</h1>
          <p className="mt-1 text-tinta-suave">Cadastro, plano e turmas de cada aluno.</p>
        </div>
        <Link href="/admin/alunos/novo" className={classeBotao}>
          + Cadastrar aluno
        </Link>
      </div>

      {aguardando.size > 0 && filtro !== "aguardando" && (
        <Link
          href="/admin/alunos?filtro=aguardando"
          className="mb-4 block rounded-2xl border-2 border-sol-400 bg-areia-50 px-4 py-3 text-sm font-semibold text-verde-900 hover:border-sol-500"
        >
          {aguardando.size === 1 ? "1 cadastro feito pelo site aguarda" : `${aguardando.size} cadastros feitos pelo site aguardam`} aprovação.
          Abra o aluno e marque “Ativo” para liberar o acesso.
        </Link>
      )}

      <form className="mb-4 flex flex-wrap gap-3" role="search">
        <input
          name="q"
          defaultValue={busca}
          placeholder="Buscar por nome, e-mail ou telefone"
          className={`${classeCampo} max-w-md flex-1`}
        />
        <select name="filtro" defaultValue={filtro} className={`${classeCampo} w-auto`}>
          {Object.entries(FILTROS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
        <button className="rounded-full border-2 border-verde-700 px-5 text-sm font-bold text-verde-700 transition hover:bg-verde-700 hover:text-white">
          Filtrar
        </button>
      </form>

      {alunos.length === 0 ? (
        <Vazio>
          {busca || filtro !== "ativos"
            ? "Nenhum aluno encontrado com esses filtros."
            : "Nenhum aluno cadastrado ainda. Quem cria conta pelo site aparece em “Aguardando aprovação”."}
          {equipe.length > 0 && (
            <span className="mt-2 block">
              {equipe.map((p) => `${p.nome} (${rotuloPapel[p.papel]})`).join(", ")}{" "}
              {equipe.length === 1 ? "é da equipe" : "são da equipe"} e não aparece aqui: cada conta tem um papel só.
              Para alguém da equipe fazer aula, cadastre uma conta de aluno com outro e-mail.
            </span>
          )}
        </Vazio>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-areia-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-areia-200 bg-areia-50 text-xs uppercase tracking-wider text-tinta-suave">
              <tr>
                <th className="px-5 py-3 font-bold">Aluno</th>
                <th className="px-5 py-3 font-bold">Contato</th>
                <th className="px-5 py-3 font-bold">Plano</th>
                <th className="px-5 py-3 font-bold">Turmas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-areia-100">
              {alunos.map((aluno) => {
                const mats = porAluno.get(aluno.id) ?? [];
                const ativas = mats.filter((m) => m.status === "ativa");
                const pausadas = mats.filter((m) => m.status === "pausada");
                return (
                  <tr key={aluno.id} className="transition hover:bg-areia-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/alunos/${aluno.id}`} className="font-bold text-verde-900 hover:underline">
                        {aluno.nome}
                      </Link>
                      {!aluno.ativo && (
                        <span className="ml-2">
                          <Selo cor="cinza">Inativo</Selo>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-tinta-suave">
                      <p>{aluno.email}</p>
                      {aluno.telefone && <p className="text-xs">{aluno.telefone}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ativas.map((m, i) => (
                          <Selo key={i} cor="verde">
                            {m.planos?.nome ?? "Plano"}
                          </Selo>
                        ))}
                        {pausadas.map((m, i) => (
                          <Selo key={`p${i}`} cor="sol">
                            {m.planos?.nome ?? "Plano"} (pausada)
                          </Selo>
                        ))}
                        {mats.length === 0 && <Selo cor="cinza">Sem plano</Selo>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {ativas.map((m, i) => {
                        const usadas = m.matricula_turmas.length;
                        const limite = m.planos?.aulas_por_semana ?? 0;
                        return (
                          <p key={i} className={usadas < limite ? "font-semibold text-sol-500" : "text-tinta-suave"}>
                            {usadas} de {limite}
                            {usadas < limite && " · falta escolher"}
                          </p>
                        );
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
