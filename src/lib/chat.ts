// Chat aluno <-> recepção (tabelas beach.conversas e beach.mensagens).
import { FUSO } from "@/lib/agenda/datas";

export type Mensagem = {
  id: number;
  aluno_id: string;
  da_equipe: boolean;
  texto: string;
  created_at: string;
};

export type ItemCaixa = {
  aluno_id: string;
  aluno: string;
  email: string | null;
  ultima_mensagem_em: string;
  ultima_texto: string | null;
  ultima_da_equipe: boolean | null;
  nao_lidas: number;
};

export const LIMITE_TEXTO = 2000;
// Quantas mensagens carregar por conversa (as mais recentes).
export const LIMITE_HISTORICO = 200;

const dia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO });
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const diaMes = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });
const diaLongo = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" });

export function diaDe(iso: string) {
  return dia.format(new Date(iso));
}

export function horaDe(iso: string) {
  return hora.format(new Date(iso));
}

// Separador de dia na conversa: "Hoje", "Ontem" ou "terça-feira, 24 de novembro".
export function rotuloDia(iso: string, agora = new Date()) {
  const d = diaDe(iso);
  const hojeStr = dia.format(agora);
  const ontem = dia.format(new Date(agora.getTime() - 86_400_000));
  if (d === hojeStr) return "Hoje";
  if (d === ontem) return "Ontem";
  return diaLongo.format(new Date(iso));
}

// Na caixa de entrada: hora se for hoje, senão dd/mm.
export function quandoCurto(iso: string, agora = new Date()) {
  return diaDe(iso) === dia.format(agora) ? horaDe(iso) : diaMes.format(new Date(iso));
}
