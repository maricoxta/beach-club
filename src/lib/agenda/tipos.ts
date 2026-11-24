export const STATUS_AULA = ["agendada", "realizada", "cancelada"] as const;
export type StatusAula = (typeof STATUS_AULA)[number];

export const STATUS_PRESENCA = ["presente", "falta", "falta_justificada"] as const;
export type StatusPresenca = (typeof STATUS_PRESENCA)[number];

export const rotuloStatusAula: Record<StatusAula, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

export const rotuloPresenca: Record<StatusPresenca, string> = {
  presente: "Presente",
  falta: "Falta",
  falta_justificada: "Falta justificada",
};

export type Turma = {
  id: string;
  nome: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  vagas: number;
  ativo: boolean;
  modalidade_id: string;
  nivel_id: string;
  professor_id: string;
  quadra_id: string;
  modalidade: { nome: string } | null;
  nivel: { nome: string } | null;
  professor: { nome: string } | null;
  quadra: { nome: string } | null;
};

export type Aula = {
  id: string;
  data: string;
  status: StatusAula;
  observacao: string | null;
  turma_id: string;
  professor_id: string | null;
  quadra_id: string | null;
  professor: { nome: string } | null;
  quadra: { nome: string } | null;
  turma: Turma | null;
};

export type ItemChamada = {
  aluno_id: string;
  nome: string;
  matriculado: boolean;
  presenca_id: string | null;
  status: StatusPresenca | null;
  observacao: string | null;
};

export type Opcao = { id: string; nome: string };
