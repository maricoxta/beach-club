// Traduz erros do Postgres/PostgREST em mensagens para a recepção.
export function mensagemErro(error: { code?: string; message: string } | null | undefined, padrao = "Não foi possível salvar.") {
  if (!error) return padrao;
  const msg = error.message ?? "";
  if (msg.includes("turmas_quadra_sem_conflito")) return "Já existe uma turma ativa nessa quadra nesse horário.";
  if (msg.includes("turmas_professor_sem_conflito")) return "Esse professor já tem outra turma nesse horário.";
  if (msg.includes("não é professor")) return "O perfil escolhido não é professor.";
  if (msg.includes("aulas_turma_id_data_key") || msg.includes("presencas_aula_id_aluno_id_key")) return "Esse registro já existe.";
  if (error.code === "23505") return "Já existe um cadastro com esse nome.";
  if (error.code === "42501" || error.code === "insufficient_privilege") return "Você não tem permissão para isso.";
  if (error.code === "23514" || error.code === "P0001") return msg;
  return padrao;
}
