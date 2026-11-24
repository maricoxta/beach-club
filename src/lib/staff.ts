import "server-only";
import { getSessao, type Perfil } from "@/lib/sessao";

// Checagem para Server Actions da administração/recepção.
// Server Actions podem ser chamadas por POST direto, então não basta o layout.
// A proteção definitiva continua sendo o RLS do banco.
export async function exigirStaff(): Promise<Perfil> {
  const { perfil } = await getSessao();
  if (!perfil || !perfil.ativo || (perfil.papel !== "admin" && perfil.papel !== "recepcao")) {
    throw new Error("Acesso restrito à administração/recepção.");
  }
  return perfil;
}

// Traduz erros do PostgREST/Postgres para mensagens para a recepção.
// As exceções dos triggers do banco já vêm em português e são repassadas.
export function mensagemErro(error: { code?: string; message?: string } | null, contexto?: string) {
  if (!error) return "";
  switch (error.code) {
    case "23505":
      return contexto ? `Já existe ${contexto} com esses dados.` : "Registro duplicado.";
    case "23503":
      return "Este registro está em uso por outros cadastros e não pode ser removido.";
    case "42501":
      return "Você não tem permissão para esta ação.";
    case "23514":
    case "P0001":
      return error.message ?? "Dados inválidos.";
    default:
      console.error("[db]", error.code, error.message);
      return "Não foi possível salvar. Tente novamente.";
  }
}

export function texto(form: FormData, campo: string) {
  return String(form.get(campo) ?? "").trim();
}

export function textoOuNull(form: FormData, campo: string) {
  return texto(form, campo) || null;
}

// Aceita "150", "150,50" e "1.150,50".
export function numero(form: FormData, campo: string): number | null {
  const bruto = texto(form, campo);
  if (!bruto) return null;
  const normalizado = bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}
