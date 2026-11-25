import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Aula, ItemChamada, Opcao, Turma } from "./tipos";

// Embeds do PostgREST. perfis vai com o nome da coluna: beach.avisos_lidos (aluno_id, aula_id) cria um
// segundo caminho aulas<->perfis e o embed sem dica dá PGRST201.
export const SELECT_TURMA =
  "id, nome, dia_semana, hora_inicio, hora_fim, vagas, ativo, modalidade_id, nivel_id, professor_id, quadra_id," +
  " modalidade:modalidades(nome), nivel:niveis(nome), professor:perfis!professor_id(nome), quadra:quadras(nome)";

export const SELECT_AULA =
  `id, data, status, observacao, turma_id, professor_id, quadra_id, professor:perfis!professor_id(nome), quadra:quadras(nome), turma:turmas(${SELECT_TURMA})`;

function falha(contexto: string, error: { code?: string; message: string }): never {
  console.error(`[agenda] ${contexto}:`, error.code, error.message);
  throw new Error(`Não foi possível carregar ${contexto}.`);
}

export function ordenarAulas(aulas: Aula[]) {
  return aulas.sort(
    (a, b) => a.data.localeCompare(b.data) || (a.turma?.hora_inicio ?? "").localeCompare(b.turma?.hora_inicio ?? ""),
  );
}

export async function listarTurmas(filtro: { ativas?: boolean; professorId?: string; ids?: string[] } = {}) {
  const supabase = await createClient();
  let q = supabase.from("turmas").select(SELECT_TURMA);
  if (filtro.ativas) q = q.eq("ativo", true);
  if (filtro.professorId) q = q.eq("professor_id", filtro.professorId);
  if (filtro.ids) q = q.in("id", filtro.ids.length ? filtro.ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data, error } = await q.order("dia_semana").order("hora_inicio");
  if (error) falha("as turmas", error);
  return data as unknown as Turma[];
}

export async function buscarTurma(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("turmas").select(SELECT_TURMA).eq("id", id).maybeSingle();
  if (error) falha("a turma", error);
  return data as unknown as Turma | null;
}

export async function listarAulas(filtro: { de: string; ate: string; professorId?: string; turmaIds?: string[]; ids?: string[] }) {
  const supabase = await createClient();
  let q = supabase.from("aulas").select(SELECT_AULA).gte("data", filtro.de).lte("data", filtro.ate);
  if (filtro.professorId) q = q.eq("professor_id", filtro.professorId);
  if (filtro.turmaIds) q = q.in("turma_id", filtro.turmaIds.length ? filtro.turmaIds : ["00000000-0000-0000-0000-000000000000"]);
  if (filtro.ids) q = q.in("id", filtro.ids.length ? filtro.ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data, error } = await q.order("data");
  if (error) falha("as aulas", error);
  return ordenarAulas(data as unknown as Aula[]);
}

export async function buscarAula(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("aulas").select(SELECT_AULA).eq("id", id).maybeSingle();
  if (error) falha("a aula", error);
  return data as unknown as Aula | null;
}

export async function listaChamada(aulaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lista_chamada", { p_aula: aulaId });
  if (error) falha("a lista de chamada", error);
  return (data ?? []) as ItemChamada[];
}

// Vagas ocupadas (matrículas ativas) por turma.
export async function ocupacaoTurmas(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("turmas_ocupacao");
  if (error) falha("a ocupação das turmas", error);
  return new Map((data as { turma_id: string; ocupadas: number }[]).map((o) => [o.turma_id, o.ocupadas]));
}

export async function alunosDaTurma(turmaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("alunos_da_turma", { p_turma: turmaId });
  if (error) falha("os alunos da turma", error);
  return (data ?? []) as { aluno_id: string; nome: string; telefone: string | null; data_inicio: string }[];
}

// Cadastros usados nos formulários.
export async function opcoesCadastro() {
  const supabase = await createClient();
  const [modalidades, niveis, quadras, professores] = await Promise.all([
    supabase.from("modalidades").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("niveis").select("id, nome").eq("ativo", true).order("ordem"),
    supabase.from("quadras").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("perfis").select("id, nome").in("papel", ["professor", "admin"]).eq("ativo", true).order("nome"),
  ]);
  for (const [nome, r] of Object.entries({ modalidades, niveis, quadras, professores })) {
    if (r.error) falha(nome, r.error);
  }
  return {
    modalidades: (modalidades.data ?? []) as Opcao[],
    niveis: (niveis.data ?? []) as Opcao[],
    quadras: (quadras.data ?? []) as Opcao[],
    professores: (professores.data ?? []) as Opcao[],
  };
}

// Turmas do aluno logado (via matrículas ativas; RLS limita ao próprio aluno).
export async function turmasDoAluno(alunoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matriculas")
    .select("id, matricula_turmas(turma_id)")
    .eq("aluno_id", alunoId)
    .eq("status", "ativa");
  if (error) falha("suas matrículas", error);
  const ids = new Set<string>();
  for (const m of (data ?? []) as { matricula_turmas: { turma_id: string }[] }[]) {
    for (const mt of m.matricula_turmas) ids.add(mt.turma_id);
  }
  return [...ids];
}

export async function vagasLivresAula(aulaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vagas_livres_aula", { p_aula: aulaId });
  if (error) {
    console.error("[agenda] vagas_livres_aula:", error.code, error.message);
    return null;
  }
  return data as number | null;
}

// Reservas do aluno logado em outras turmas (reposição ou aula extra do plano).
export type Reserva = { aula_reposicao_id: string; tipo: "reposicao" | "extra" };
export async function minhasReservas(alunoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reposicoes").select("aula_reposicao_id, tipo").eq("aluno_id", alunoId);
  if (error) {
    console.error("[agenda] reposicoes:", error.code, error.message);
    return [] as Reserva[];
  }
  return (data ?? []) as Reserva[];
}
