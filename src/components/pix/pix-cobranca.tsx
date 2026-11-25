import { moeda } from "@/lib/formato";
import { TIPOS_CHAVE, type ConfigPix } from "@/lib/pix";
import { cobrancaPix } from "@/lib/pix-dados";
import { BotaoCopiar } from "./botao-copiar";

// QR Code + "copia e cola" de uma cobrança, com o valor exato. Server Component.
export async function PixCobranca({
  config,
  valor,
  prefixo,
  id,
  instrucao,
}: {
  config: ConfigPix;
  valor: number;
  prefixo: string;
  id: string;
  instrucao?: string;
}) {
  const pix = await cobrancaPix(config, valor, prefixo, id);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div
        className="mx-auto w-48 shrink-0 rounded-2xl border border-areia-200 bg-white p-2 sm:mx-0 [&>svg]:h-auto [&>svg]:w-full"
        role="img"
        aria-label={`QR Code Pix de ${moeda(valor)}`}
        dangerouslySetInnerHTML={{ __html: pix.qrSvg }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <p className="font-display text-2xl font-bold text-verde-900">{moeda(valor)}</p>
          <p className="text-xs text-tinta-suave">
            Para {config.nome_recebedor} · {TIPOS_CHAVE[config.tipo_chave]} {config.chave}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-tinta-suave">
          Pix copia e cola
          <textarea
            id={`pix-${pix.copiaECola.slice(-8)}`}
            readOnly
            rows={3}
            value={pix.copiaECola}
            className="w-full resize-none break-all rounded-xl border border-areia-200 bg-areia-50 p-2 font-mono text-[11px] text-verde-900"
          />
        </label>
        <div>
          <BotaoCopiar texto={pix.copiaECola} />
        </div>
        <p className="text-xs text-tinta-suave">
          {instrucao ??
            "Abra o app do seu banco, escolha Pix > Ler QR Code ou Pix copia e cola. O valor já vem preenchido. Depois de pagar, a recepção confirma e a cobrança aparece como paga aqui."}
        </p>
      </div>
    </div>
  );
}
