// Espelha o enum beach.papel do banco.
export const PAPEIS = ["admin", "recepcao", "professor", "aluno"] as const;
export type Papel = (typeof PAPEIS)[number];

export type Area = "admin" | "professor" | "aluno";

export function isPapel(valor: unknown): valor is Papel {
  return typeof valor === "string" && (PAPEIS as readonly string[]).includes(valor);
}

// Admin e recepção compartilham a área de administração/recepção.
export function areaDoPapel(papel: Papel): Area {
  if (papel === "admin" || papel === "recepcao") return "admin";
  return papel;
}

export function rotaDoPapel(papel: Papel): `/${Area}` {
  return `/${areaDoPapel(papel)}`;
}

export const rotuloPapel: Record<Papel, string> = {
  admin: "Administração",
  recepcao: "Recepção",
  professor: "Professor(a)",
  aluno: "Aluno(a)",
};
