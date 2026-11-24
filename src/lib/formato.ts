// Formatadores compartilhados (pt-BR).

const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function moeda(valor: number | string | null | undefined) {
  return moedaFmt.format(Number(valor ?? 0));
}

// ISO: 1 = segunda ... 7 = domingo (igual a beach.turmas.dia_semana).
export const DIAS_SEMANA: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
};

export const DIAS_SEMANA_CURTO: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
  7: "Dom",
};

// "08:00:00" -> "08:00"
export function hora(valor: string | null | undefined) {
  return (valor ?? "").slice(0, 5);
}

// "2026-11-24" -> "24/11/2026" (sem passar por Date para não sofrer com fuso).
export function data(valor: string | null | undefined) {
  if (!valor) return "";
  const [a, m, d] = valor.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

// Data de hoje no fuso do clube, no formato do banco (YYYY-MM-DD).
export function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function vezesPorSemana(n: number) {
  return `${n}x por semana`;
}
