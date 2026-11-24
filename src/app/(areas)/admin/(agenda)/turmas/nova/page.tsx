import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho, Cartao, LinkVoltar, Vazio } from "@/components/agenda/ui";
import { opcoesCadastro } from "@/lib/agenda/consultas";
import { salvarTurma } from "../../acoes";
import { FormTurma } from "../form-turma";

export const instant = false;
export const metadata: Metadata = { title: "Nova turma" };

export default async function NovaTurmaPage() {
  const opcoes = await opcoesCadastro();
  const faltam = [
    !opcoes.quadras.length && { href: "/admin/quadras", rotulo: "uma quadra" },
    !opcoes.professores.length && { href: "/admin/equipe", rotulo: "um professor" },
  ].filter(Boolean) as { href: string; rotulo: string }[];

  return (
    <>
      <LinkVoltar href="/admin/turmas">Turmas</LinkVoltar>
      <Cabecalho titulo="Nova turma" subtitulo="Horário semanal fixo com professor, quadra e vagas." />
      {faltam.length ? (
        <Vazio>
          Antes de criar turmas, cadastre{" "}
          {faltam.map((f, i) => (
            <span key={f.href}>
              {i > 0 && " e "}
              <Link href={f.href} className="font-semibold text-verde-700 underline">
                {f.rotulo}
              </Link>
            </span>
          ))}
          .
        </Vazio>
      ) : (
        <Cartao className="max-w-2xl">
          <FormTurma acao={salvarTurma.bind(null, null)} opcoes={opcoes} />
        </Cartao>
      )}
    </>
  );
}
