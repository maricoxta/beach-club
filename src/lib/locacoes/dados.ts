import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listarAulas, listarTurmas } from "@/lib/agenda/consultas";
import { diaSemanaIso, somarDias } from "@/lib/agenda/datas";
import { instante, minutosDe, paraLocal, situacaoPagamento, type SituacaoPagamento, type StatusLocacao } from "./regras";

export type Quadra = { id: string; nome: string; valor_hora: number };

export type Locacao = {
  id: string;
  quadra_id: string;
  quadra: string;
  cliente_id: string | null;
  cliente: string;
  telefone: string | null;
  data: string;
  ini: number; // minutos desde 0h (fuso do clube)
  fim: number;
  horas: number;
  valor_hora: number;
  total: number;
  pago: number;
  pagamento: SituacaoPagamento;
  status: StatusLocacao;
  observacao: string | null;
  pagamentos: { id: string; valor: number; forma: string; pago_em: string }[];
};

// Ocupação da quadra por turma num dia (bloqueia locação, como o trigger beach.tg_locacoes_valida).
export type OcupacaoTurma = {
  quadra_id: string;
  data: string;
  ini: number;
  fim: number;
  turma: string;
  aulaId: string | null;
  // true quando a aula daquele dia foi trocada para outra quadra (só informativo, o banco não bloqueia).
  remanejada: boolean;
};

// O embed de perfis precisa do nome da FK: locacoes tem duas FKs para perfis (cliente_id e criado_por).
const SELECT_LOCACAO =
  "id, quadra_id, cliente_id, cliente_nome, cliente_telefone, inicio, fim, horas, valor_hora, valor_total, status, observacao," +
  " quadra:quadras(nome), cliente:perfis!locacoes_cliente_id_fkey(nome, telefone)," +
  " pagamentos(id, valor, forma, pago_em)";

type Linha = {
  id: string;
  quadra_id: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  inicio: string;
  fim: string;
  horas: number;
  valor_hora: number;
  valor_total: number;
  status: StatusLocacao;
  observacao: string | null;
  quadra: { nome: string } | null;
  cliente: { nome: string; telefone: string | null } | null;
  pagamentos: { id: string; valor: number; forma: string; pago_em: string }[];
};

function falha(contexto: string, error: { code?: string; message: string }): never {
  console.error(`[locacoes] ${contexto}:`, error.code, error.message);
  throw new Error(`Não foi possível carregar ${contexto}.`);
}

function mapear(l: Linha): Locacao {
  const ini = paraLocal(l.inicio);
  const fimLocal = paraLocal(l.fim);
  const total = Number(l.valor_total);
  const pago = l.pagamentos.reduce((s, p) => s + Number(p.valor), 0);
  return {
    id: l.id,
    quadra_id: l.quadra_id,
    quadra: l.quadra?.nome ?? "Quadra",
    cliente_id: l.cliente_id,
    cliente: l.cliente_nome || l.cliente?.nome || "Cliente",
    telefone: l.cliente_telefone || l.cliente?.telefone || null,
    data: ini.data,
    ini: ini.minutos,
    // Termina à meia-noite: fim no dia seguinte vira 24h.
    fim: fimLocal.data === ini.data ? fimLocal.minutos : 1440,
    horas: Number(l.horas),
    valor_hora: Number(l.valor_hora),
    total,
    pago,
    pagamento: situacaoPagamento(total, pago),
    status: l.status,
    observacao: l.observacao,
    pagamentos: [...l.pagamentos].sort((a, b) => a.pago_em.localeCompare(b.pago_em)),
  };
}

export async function listarQuadras(): Promise<Quadra[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quadras").select("id, nome, valor_hora").eq("ativo", true).order("nome");
  if (error) falha("as quadras", error);
  return (data ?? []).map((q) => ({ ...q, valor_hora: Number(q.valor_hora) }));
}

export async function listarLocacoes(filtro: { de: string; ate: string; incluirCanceladas?: boolean; quadraId?: string }) {
  const supabase = await createClient();
  let q = supabase
    .from("locacoes")
    .select(SELECT_LOCACAO)
    .gte("inicio", instante(filtro.de, 0))
    .lt("inicio", instante(somarDias(filtro.ate, 1), 0));
  if (!filtro.incluirCanceladas) q = q.neq("status", "cancelada");
  if (filtro.quadraId) q = q.eq("quadra_id", filtro.quadraId);
  const { data, error } = await q.order("inicio");
  if (error) falha("as locações", error);
  return (data as unknown as Linha[]).map(mapear);
}

export async function buscarLocacao(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("locacoes").select(SELECT_LOCACAO).eq("id", id).maybeSingle();
  if (error) falha("a locação", error);
  return data ? mapear(data as unknown as Linha) : null;
}

// Turmas que ocupam as quadras em cada dia do período: turma ativa no dia da semana,
// a menos que a aula daquele dia esteja cancelada (mesma regra do trigger do banco).
export async function ocupacaoTurmas(de: string, ate: string): Promise<OcupacaoTurma[]> {
  const [turmas, aulas] = await Promise.all([listarTurmas({ ativas: true }), listarAulas({ de, ate })]);
  const aulaPorTurmaDia = new Map(aulas.map((a) => [`${a.turma_id}|${a.data}`, a]));
  const resultado: OcupacaoTurma[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) {
    const dow = diaSemanaIso(d);
    for (const t of turmas) {
      if (t.dia_semana !== dow) continue;
      const aula = aulaPorTurmaDia.get(`${t.id}|${d}`);
      if (aula?.status === "cancelada") continue;
      const base = { data: d, ini: minutosDe(t.hora_inicio), fim: minutosDe(t.hora_fim), turma: t.nome, aulaId: aula?.id ?? null };
      resultado.push({ ...base, quadra_id: t.quadra_id, remanejada: false });
      if (aula?.quadra_id && aula.quadra_id !== t.quadra_id) {
        resultado.push({ ...base, quadra_id: aula.quadra_id, remanejada: true });
      }
    }
  }
  return resultado;
}

export async function listarAlunosAtivos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome, telefone")
    .eq("papel", "aluno")
    .eq("ativo", true)
    .order("nome");
  if (error) falha("os alunos", error);
  return (data ?? []) as { id: string; nome: string; telefone: string | null }[];
}
