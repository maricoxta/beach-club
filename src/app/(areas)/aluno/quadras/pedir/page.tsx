import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cabecalho, LinkVoltar } from "@/components/agenda/ui";
import { Painel } from "@/components/ui";
import { formatarDataLonga, hoje, isData, somarDias } from "@/lib/agenda/datas";
import { horariosOcupados, listarQuadras } from "@/lib/locacoes/dados";
import { DIAS_PEDIDO, HORA_ABRE, HORA_FECHA, MAX_HORAS } from "@/lib/locacoes/regras";
import { pedirLocacao } from "../acoes";
import { FormPedido } from "./form-pedido";

export const instant = false;
export const metadata: Metadata = { title: "Pedir locação" };

export default async function PedirPage({ searchParams }: PageProps<"/aluno/quadras/pedir">) {
  const sp = await searchParams;
  const dia = hoje();
  const data = isData(sp.data) ? sp.data : null;
  const hora = Number(sp.hora);
  if (!data || data < dia || data > somarDias(dia, DIAS_PEDIDO) || !Number.isInteger(hora) || hora < HORA_ABRE || hora >= HORA_FECHA) {
    notFound();
  }
  const [quadras, ocupados] = await Promise.all([listarQuadras(), horariosOcupados(data, data)]);
  const quadra = quadras.find((q) => q.id === sp.quadra);
  if (!quadra) notFound();

  // Duração máxima até o próximo horário ocupado dessa quadra (ou o fechamento).
  const proximo = ocupados
    .filter((o) => o.quadra_id === quadra.id && o.fim_min > hora * 60)
    .reduce((min, o) => Math.min(min, o.inicio_min), HORA_FECHA * 60);
  const maxHoras = Math.max(1, Math.min(MAX_HORAS, Math.floor((proximo - hora * 60) / 60)));

  return (
    <>
      <LinkVoltar href={`/aluno/quadras?data=${data}`}>Horários livres</LinkVoltar>
      <Cabecalho titulo={`Pedir ${quadra.nome}`} subtitulo={`${formatarDataLonga(data)}, a partir das ${hora}h.`} />
      <Painel className="max-w-lg">
        <FormPedido acao={pedirLocacao} quadraId={quadra.id} data={data} hora={hora} maxHoras={maxHoras} valorHora={quadra.valor_hora} />
      </Painel>
    </>
  );
}
