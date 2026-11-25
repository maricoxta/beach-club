// Datas da agenda. O clube opera no fuso de São Paulo; datas trafegam como "YYYY-MM-DD".
export const FUSO = "America/Sao_Paulo";

// ISO: 1 = segunda ... 7 = domingo (igual a beach.turmas.dia_semana).
export const DIAS_SEMANA: Record<number, { curto: string; longo: string }> = {
  1: { curto: "Seg", longo: "Segunda" },
  2: { curto: "Ter", longo: "Terça" },
  3: { curto: "Qua", longo: "Quarta" },
  4: { curto: "Qui", longo: "Quinta" },
  5: { curto: "Sex", longo: "Sexta" },
  6: { curto: "Sáb", longo: "Sábado" },
  7: { curto: "Dom", longo: "Domingo" },
};

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function isData(valor: unknown): valor is string {
  return typeof valor === "string" && RE_DATA.test(valor) && !Number.isNaN(Date.parse(`${valor}T00:00:00Z`));
}

export function hoje(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
}

function utc(data: string) {
  return new Date(`${data}T00:00:00Z`);
}

export function somarDias(data: string, dias: number): string {
  const d = utc(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diaSemanaIso(data: string): number {
  const dow = utc(data).getUTCDay();
  return dow === 0 ? 7 : dow;
}

// Segunda-feira da semana da data.
export function inicioDaSemana(data: string): string {
  return somarDias(data, 1 - diaSemanaIso(data));
}

export function diasDaSemana(segunda: string): string[] {
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
}

export function formatarData(data: string, opcoes: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" }) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opcoes }).format(utc(data));
}

export function formatarDataLonga(data: string) {
  return formatarData(data, { weekday: "long", day: "numeric", month: "long" });
}

// "18:00:00" -> "18h", "18:30:00" -> "18h30"
export function formatarHora(hora: string) {
  const [h, m] = hora.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

export function faixaHorario(inicio: string, fim: string) {
  return `${formatarHora(inicio)} às ${formatarHora(fim)}`;
}

// Início da aula (data + hora no fuso de São Paulo, UTC-3 sem horário de verão desde 2019) menos 2 horas.
// Mesmo prazo de beach.validar_desmarcacao no banco.
export const HORAS_ANTECEDENCIA_DESMARCAR = 2;
export function prazoDesmarcar(data: string, horaInicio: string): Date {
  const inicio = new Date(`${data}T${horaInicio.slice(0, 8)}-03:00`);
  return new Date(inicio.getTime() - HORAS_ANTECEDENCIA_DESMARCAR * 3600_000);
}

// "18:00:00" menos 2h -> "16:00:00" (só para exibir o prazo).
export function horaMenos(hora: string, horas: number) {
  const [h, m] = hora.split(":").map(Number);
  const total = (((h - horas) * 60 + m) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
}

// Instante atual (servidor). Separado para as páginas não chamarem Date.now() no render.
export function agora(): number {
  return Date.now();
}

// timestamptz -> "2026-11-28T18:00" no fuso do clube (valor de <input type="datetime-local">).
export function paraInputLocal(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// "2026-11-28T18:00" (horário do clube) -> ISO com fuso, para o banco.
export function deInputLocal(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  return `${valor}:00-03:00`;
}

// "sex., 28/11 às 18h"
export function formatarDataHora(iso: string): string {
  const local = paraInputLocal(iso);
  const [data, hora] = local.split("T");
  return `${DIAS_SEMANA[diaSemanaIso(data)].curto.toLowerCase()}, ${formatarData(data)} às ${formatarHora(hora)}`;
}
