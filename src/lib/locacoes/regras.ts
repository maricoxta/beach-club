// Regras e formatação da locação avulsa (puro, usado no servidor e no cliente).
// O clube opera em America/Sao_Paulo (UTC-3, sem horário de verão desde 2019), como no resto do app.
import { FUSO } from "@/lib/agenda/datas";

// Faixa de horários exibida na grade (slots de 1h: 6h-7h ... 22h-23h).
export const HORA_ABRE = 6;
export const HORA_FECHA = 23;
export const MAX_HORAS = 4;

export const FORMAS_PAGAMENTO = ["pix", "dinheiro", "cartao_credito", "cartao_debito", "transferencia"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];
export const rotuloForma: Record<FormaPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
};

export const STATUS_LOCACAO = ["solicitada", "reservada", "confirmada", "concluida", "cancelada"] as const;
export type StatusLocacao = (typeof STATUS_LOCACAO)[number];
export const rotuloStatus: Record<StatusLocacao, string> = {
  solicitada: "Pedido do aluno",
  reservada: "Reservada",
  confirmada: "Confirmada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

// Como o aluno vê o status da própria locação.
export const rotuloStatusAluno: Record<StatusLocacao, string> = {
  solicitada: "Aguardando confirmação",
  reservada: "Reservada",
  confirmada: "Confirmada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

// Antecedência e limites do pedido do aluno (iguais a beach.solicitar_locacao).
export const ANTECEDENCIA_PEDIDO_H = 2;
export const DIAS_PEDIDO = 30;

export type SituacaoPagamento = "pago" | "parcial" | "a_pagar" | "sem_custo";
export const rotuloPagamento: Record<SituacaoPagamento, string> = {
  pago: "Pago",
  parcial: "Pago em parte",
  a_pagar: "A pagar",
  sem_custo: "Sem custo",
};

export function situacaoPagamento(total: number, pago: number): SituacaoPagamento {
  if (total <= 0) return "sem_custo";
  if (pago >= total) return "pago";
  return pago > 0 ? "parcial" : "a_pagar";
}

// Timestamp do banco -> data (YYYY-MM-DD) e minutos desde 0h no fuso do clube.
const fmtLocal = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function paraLocal(ts: string | Date): { data: string; minutos: number } {
  const p = Object.fromEntries(fmtLocal.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

// Data local + minutos -> ISO (UTC) para gravar no banco.
export function instante(data: string, minutos: number): string {
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return new Date(`${data}T${h}:${m}:00-03:00`).toISOString();
}

// 540 -> "9h", 570 -> "9h30"
export function horaMin(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

// "18:30:00" -> 1110
export function minutosDe(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}
