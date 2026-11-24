// Calendário de frequência: tipos de atividade, formatação e datas do mês.
import { hoje, isData, somarDias } from "@/lib/agenda/datas";

export const BUCKET_FOTOS = "beach-atividades";

export const TIPOS_ATIVIDADE = [
  "aula_beach_tenis",
  "aula_volei",
  "play_beach_tenis",
  "play_volei",
  "play_futvolei",
] as const;
export type TipoAtividade = (typeof TIPOS_ATIVIDADE)[number];

export type Esporte = "beach_tenis" | "volei" | "futvolei";

export const INFO_TIPO: Record<TipoAtividade, { rotulo: string; esporte: Esporte; aula: boolean }> = {
  aula_beach_tenis: { rotulo: "Aula Beach Tênis", esporte: "beach_tenis", aula: true },
  aula_volei: { rotulo: "Aula Vôlei", esporte: "volei", aula: true },
  play_beach_tenis: { rotulo: "Play Beach Tênis", esporte: "beach_tenis", aula: false },
  play_volei: { rotulo: "Play Vôlei", esporte: "volei", aula: false },
  play_futvolei: { rotulo: "Play Futvôlei", esporte: "futvolei", aula: false },
};

export function isTipoAtividade(valor: unknown): valor is TipoAtividade {
  return typeof valor === "string" && (TIPOS_ATIVIDADE as readonly string[]).includes(valor);
}

export type Atividade = {
  id: string;
  aluno_id: string;
  data: string;
  tipo: TipoAtividade;
  duracao_min: number | null;
  distancia_km: number | null;
  calorias: number | null;
  passos: number | null;
  foto_path: string | null;
  observacao: string | null;
  created_at: string;
};

export type AtividadeComFoto = Atividade & { fotoUrl: string | null };

export type Resumo = {
  checkins: number;
  dias_ativos: number;
  duracao_min: number;
  distancia_km: number;
  calorias: number;
  passos: number;
};

export const RESUMO_VAZIO: Resumo = { checkins: 0, dias_ativos: 0, duracao_min: 0, distancia_km: 0, calorias: 0, passos: 0 };

// 7776 -> "129h 36m"; 45 -> "45m"
export function formatarDuracao(min: number | null | undefined) {
  const total = Math.round(Number(min ?? 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function formatarNumero(n: number | null | undefined) {
  return inteiro.format(Number(n ?? 0));
}

export function formatarKm(n: number | null | undefined) {
  return `${decimal.format(Number(n ?? 0))} km`;
}

// ---------- mês ----------

export function mesDe(data: string) {
  return data.slice(0, 7);
}

export function isMes(valor: unknown): valor is string {
  return typeof valor === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

export function somarMeses(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function rotuloMes(mes: string) {
  const texto = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(`${mes}-01T00:00:00Z`),
  );
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Grade do mês começando no domingo: semanas completas (inclui dias dos meses vizinhos).
export function gradeDoMes(mes: string): string[][] {
  const primeiro = `${mes}-01`;
  const dow = new Date(`${primeiro}T00:00:00Z`).getUTCDay(); // 0 = domingo
  let dia = somarDias(primeiro, -dow);
  const semanas: string[][] = [];
  do {
    semanas.push(Array.from({ length: 7 }, (_, i) => somarDias(dia, i)));
    dia = somarDias(dia, 7);
  } while (mesDe(dia) === mes);
  return semanas;
}

// Lê ?mes= e ?dia= da URL com valores padrão seguros.
export function lerFiltros(params: { mes?: string | string[]; dia?: string | string[] }) {
  const hojeStr = hoje();
  const diaParam = typeof params.dia === "string" && isData(params.dia) ? params.dia : null;
  const mes = isMes(params.mes) ? params.mes : diaParam ? mesDe(diaParam) : mesDe(hojeStr);
  return { hoje: hojeStr, mes, dia: diaParam && mesDe(diaParam) === mes ? diaParam : null };
}
