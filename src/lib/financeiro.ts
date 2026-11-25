// Helpers do módulo financeiro (sem dependência de servidor: usados em páginas e ações).

import { hojeISO } from "@/lib/formato";

export const FORMAS_PAGAMENTO = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
} as const;
export type FormaPagamento = keyof typeof FORMAS_PAGAMENTO;

export function isForma(valor: string): valor is FormaPagamento {
  return valor in FORMAS_PAGAMENTO;
}

export type StatusMensalidade = "aberta" | "paga" | "cancelada";

// Linha de beach.vw_mensalidades.
export type MensalidadeView = {
  id: string;
  matricula_id: string;
  aluno_id: string;
  aluno_nome: string;
  competencia: string;
  vencimento: string;
  valor: number;
  desconto: number;
  valor_liquido: number;
  valor_pago: number;
  saldo: number;
  status: StatusMensalidade;
  vencida: boolean;
  observacao: string | null;
};

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// "AAAA-MM" válido ou o mês atual (fuso do clube).
export function mesDoParametro(valor: unknown): string {
  if (typeof valor === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) return valor;
  return hojeISO().slice(0, 7);
}

// "2026-11" -> "2026-11-01" (competência no banco é sempre o dia 1).
export function competenciaDoMes(mes: string) {
  return `${mes}-01`;
}

// "2026-11" -> "novembro de 2026"
export function rotuloMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

// "2026-11" -> "nov/26"
export function rotuloMesCurto(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1].slice(0, 3)}/${String(a).slice(2)}`;
}

export function somarMeses(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

// Intervalo [início, fim) do mês em horário de Brasília, para filtrar timestamptz (pago_em).
export function intervaloDoMes(mes: string) {
  return { de: `${mes}-01T00:00:00-03:00`, ate: `${somarMeses(mes, 1)}-01T00:00:00-03:00` };
}

// Data do formulário (AAAA-MM-DD) vira meio-dia de Brasília: não muda de dia por causa do fuso.
export function pagoEmDaData(dataISO: string) {
  return `${dataISO}T12:00:00-03:00`;
}

// Situação exibida: a view já diz se está vencida; "parcial" quando há pagamento mas sobra saldo.
export function situacao(m: Pick<MensalidadeView, "status" | "vencida" | "valor_pago">) {
  if (m.status === "paga") return { rotulo: "Paga", cor: "verde" } as const;
  if (m.status === "cancelada") return { rotulo: "Cancelada", cor: "cinza" } as const;
  if (m.vencida) return { rotulo: Number(m.valor_pago) > 0 ? "Vencida (parcial)" : "Vencida", cor: "erro" } as const;
  return { rotulo: Number(m.valor_pago) > 0 ? "Parcial" : "Em aberto", cor: "sol" } as const;
}

// Telefone brasileiro para link do WhatsApp (só dígitos, com 55).
export function linkWhatsApp(telefone: string | null | undefined, mensagem: string) {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const numero = digitos.startsWith("55") && digitos.length > 11 ? digitos : `55${digitos}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
