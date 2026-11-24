import type { Metadata } from "next";
import Link from "next/link";
import { FormAcao } from "@/components/form-acao";
import { Campo, Painel, classeCampo } from "@/components/ui";
import { cadastrarAluno } from "../actions";

export const instant = false;

export const metadata: Metadata = { title: "Cadastrar aluno" };

export default function NovoAlunoPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/alunos" className="text-sm font-semibold text-verde-700 hover:underline">
        ← Voltar para alunos
      </Link>
      <h1 className="mb-2 mt-3 font-display text-3xl font-semibold text-verde-900">Cadastrar aluno</h1>
      <p className="mb-6 text-tinta-suave">
        O aluno recebe por e-mail um link para entrar e criar a senha. Você já pode matriculá-lo logo em seguida, sem
        esperar ele abrir o e-mail. Se o aluno preferir, ele também pode criar a conta sozinho pelo site.
      </p>
      <Painel>
        <FormAcao acao={cadastrarAluno} rotulo="Cadastrar e enviar link" rotuloPendente="Cadastrando…">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome completo" className="sm:col-span-2">
              <input name="nome" required autoComplete="off" className={classeCampo} />
            </Campo>
            <Campo rotulo="E-mail">
              <input name="email" type="email" required autoComplete="off" className={classeCampo} />
            </Campo>
            <Campo rotulo="Telefone / WhatsApp">
              <input name="telefone" type="tel" placeholder="(21) 99999-9999" className={classeCampo} />
            </Campo>
            <Campo rotulo="Data de nascimento">
              <input name="data_nascimento" type="date" className={classeCampo} />
            </Campo>
          </div>
        </FormAcao>
      </Painel>
    </div>
  );
}
