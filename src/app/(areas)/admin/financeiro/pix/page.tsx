import type { Metadata } from "next";
import { FormAcao } from "@/components/form-acao";
import { PixCobranca } from "@/components/pix/pix-cobranca";
import { Campo, Painel, Selo, classeCampo } from "@/components/ui";
import { TIPOS_CHAVE } from "@/lib/pix";
import { lerConfigPix } from "@/lib/pix-dados";
import { getSessao } from "@/lib/sessao";
import { salvarConfigPix } from "../acoes";

export const instant = false;

export const metadata: Metadata = { title: "Pix do clube" };

export default async function PixClubePage() {
  const [{ perfil }, config] = await Promise.all([getSessao(), lerConfigPix()]);
  const admin = perfil?.papel === "admin";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <Painel
        titulo="Chave Pix do clube"
        acao={config ? config.ativo ? <Selo cor="verde">Ativa para os alunos</Selo> : <Selo cor="sol">Pausada</Selo> : null}
      >
        <p className="mb-4 text-sm text-tinta-suave">
          Com a chave cadastrada, cada mensalidade e cada locação ganha um QR Code Pix com o valor exato, que o aluno vê
          no app. O dinheiro cai direto na conta do clube, sem taxa. A confirmação continua com a recepção: confira o
          extrato e registre o pagamento como Pix.
        </p>
        {admin ? (
          <FormAcao acao={salvarConfigPix} rotulo="Salvar chave Pix">
            <Campo rotulo="Tipo da chave">
              <select name="tipo_chave" defaultValue={config?.tipo_chave ?? "cnpj"} className={classeCampo}>
                {Object.entries(TIPOS_CHAVE).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Chave" dica="Use uma chave da conta bancária do clube. Celular com DDD.">
              <input name="chave" defaultValue={config?.chave ?? ""} required className={classeCampo} />
            </Campo>
            <Campo rotulo="Nome do recebedor" dica="Como aparece na conta do banco. Até 25 letras, sem acento.">
              <input name="nome_recebedor" defaultValue={config?.nome_recebedor ?? ""} maxLength={25} required className={classeCampo} />
            </Campo>
            <Campo rotulo="Cidade da conta" dica="Até 15 letras.">
              <input name="cidade" defaultValue={config?.cidade ?? ""} maxLength={15} required className={classeCampo} />
            </Campo>
            <label className="flex items-center gap-2 text-sm font-semibold text-verde-900">
              <input type="checkbox" name="ativo" defaultChecked={config?.ativo ?? true} className="h-4 w-4 accent-verde-700" />
              Mostrar o QR Code Pix para os alunos
            </label>
          </FormAcao>
        ) : config ? (
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-tinta-suave">{TIPOS_CHAVE[config.tipo_chave]}</dt>
              <dd className="font-semibold text-verde-900">{config.chave}</dd>
            </div>
            <div>
              <dt className="text-tinta-suave">Recebedor</dt>
              <dd className="font-semibold text-verde-900">
                {config.nome_recebedor} · {config.cidade}
              </dd>
            </div>
            <p className="text-xs text-tinta-suave">Só o admin altera a chave.</p>
          </dl>
        ) : (
          <p className="text-sm text-tinta-suave">A chave Pix ainda não foi cadastrada. Peça ao admin.</p>
        )}
      </Painel>

      {config && (
        <Painel titulo="Teste de R$ 1,00">
          <p className="mb-4 text-sm text-tinta-suave">
            Pague este QR Code pelo app do seu banco e confira se o nome do clube aparece e se o dinheiro chega na conta
            certa. Só depois deixe ativo para os alunos.
          </p>
          <PixCobranca
            config={config}
            valor={1}
            prefixo="TESTE"
            id={perfil?.id ?? "0"}
            instrucao="Este QR Code é só para teste e não fica registrado no financeiro."
          />
        </Painel>
      )}
    </div>
  );
}
