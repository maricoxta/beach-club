import type { Metadata } from "next";
import { Cabecalho, LinkVoltar, Vazio } from "@/components/agenda/ui";
import { Painel } from "@/components/ui";
import { hoje, isData } from "@/lib/agenda/datas";
import { listarAlunosAtivos, listarQuadras } from "@/lib/locacoes/dados";
import { HORA_ABRE, HORA_FECHA } from "@/lib/locacoes/regras";
import { criarLocacao } from "../acoes";
import { FormLocacao } from "./form-locacao";

export const instant = false;
export const metadata: Metadata = { title: "Nova locação" };

export default async function NovaLocacaoPage({ searchParams }: PageProps<"/admin/locacoes/nova">) {
  const sp = await searchParams;
  const [quadras, alunos] = await Promise.all([listarQuadras(), listarAlunosAtivos()]);
  const data = isData(sp.data) ? sp.data : hoje();
  const horaParam = Number(sp.hora);
  const hora = Number.isInteger(horaParam) && horaParam >= HORA_ABRE && horaParam < HORA_FECHA ? horaParam : 18;
  const quadra = quadras.find((q) => q.id === sp.quadra)?.id ?? quadras[0]?.id ?? "";

  return (
    <>
      <LinkVoltar href={`/admin/locacoes?data=${data}`}>Grade de quadras</LinkVoltar>
      <Cabecalho titulo="Nova locação" subtitulo="Reserva avulsa de quadra por hora, para alunos ou clientes de fora." />
      {quadras.length === 0 ? (
        <Vazio>Nenhuma quadra ativa cadastrada.</Vazio>
      ) : (
        <Painel className="max-w-3xl">
          <FormLocacao acao={criarLocacao} quadras={quadras} alunos={alunos} inicial={{ quadra, data, hora }} />
        </Painel>
      )}
    </>
  );
}
