import type { EstadoAcao } from "@/lib/agenda/acoes-chamada";
import { formatarDataHora, paraInputLocal } from "@/lib/agenda/datas";
import { FormLiberacao } from "./form-liberacao";

export type LinhaVagas = {
  aula_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  turma: string;
  modalidade: string;
  nivel: string;
  quadra: string | null;
  professor: string | null;
  vagas_turma: number;
  vagas_livres: number;
  liberadas: number | null;
  liberar_em: string | null;
  reservadas: number;
  disponiveis_agora: number;
  alunos_avisados: number;
};

export function SeloLiberacao({ linha, agoraMs }: { linha: LinhaVagas; agoraMs: number }) {
  if (!linha.liberadas || !linha.liberar_em) {
    return <span className="rounded-full bg-areia-100 px-2.5 py-0.5 text-xs font-bold text-tinta-suave">Não liberada</span>;
  }
  if (new Date(linha.liberar_em).getTime() > agoraMs) {
    return (
      <span className="rounded-full bg-sol-400/25 px-2.5 py-0.5 text-xs font-bold text-verde-900">
        Libera {formatarDataHora(linha.liberar_em)}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-verde-50 px-2.5 py-0.5 text-xs font-bold text-verde-700">
      {linha.disponiveis_agora > 0 ? `Liberada · ${linha.disponiveis_agora} disponíve${linha.disponiveis_agora === 1 ? "l" : "is"}` : "Liberada · esgotada"}
    </span>
  );
}

// Resumo + formulário. Máximo = livres agora + as já reservadas por reposição.
export function PainelLiberacao({
  linha,
  agoraMs,
  acao,
}: {
  linha: LinhaVagas;
  agoraMs: number;
  acao: (estado: EstadoAcao, form: FormData) => Promise<EstadoAcao>;
}) {
  const atual =
    linha.liberadas && linha.liberar_em
      ? { vagas: linha.liberadas, liberarEm: paraInputLocal(linha.liberar_em), jaValendo: new Date(linha.liberar_em).getTime() <= agoraMs }
      : null;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-tinta-suave">
        {linha.vagas_livres} livre{linha.vagas_livres === 1 ? "" : "s"} de {linha.vagas_turma}
        {linha.reservadas > 0 && ` · ${linha.reservadas} já reservada${linha.reservadas === 1 ? "" : "s"} por reposição`}
        {` · ${linha.alunos_avisados} aluno${linha.alunos_avisados === 1 ? "" : "s"} de ${linha.modalidade} ${linha.nivel} recebe${linha.alunos_avisados === 1 ? "" : "m"} o aviso`}
      </p>
      <FormLiberacao
        acao={acao}
        data={linha.data}
        horaInicio={linha.hora_inicio}
        maximo={linha.vagas_livres + linha.reservadas}
        atual={atual}
      />
    </div>
  );
}
