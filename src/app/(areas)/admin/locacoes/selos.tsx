import { Selo } from "@/components/ui";
import { rotuloPagamento, rotuloStatus, type SituacaoPagamento, type StatusLocacao } from "@/lib/locacoes/regras";

const corPagamento = { pago: "verde", parcial: "sol", a_pagar: "erro", sem_custo: "cinza" } as const;
const corStatus = { solicitada: "sol", reservada: "cinza", confirmada: "verde", concluida: "verde", cancelada: "erro" } as const;

export function SeloPagamento({ situacao }: { situacao: SituacaoPagamento }) {
  return <Selo cor={corPagamento[situacao]}>{rotuloPagamento[situacao]}</Selo>;
}

export function SeloStatusLocacao({ status }: { status: StatusLocacao }) {
  return <Selo cor={corStatus[status]}>{rotuloStatus[status]}</Selo>;
}
