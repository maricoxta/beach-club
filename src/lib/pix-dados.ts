import "server-only";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { gerarPixCopiaECola, isTipoChave, txidDe, type ConfigPix } from "@/lib/pix";

// Chave Pix do clube (linha única em beach.config_pix). null se ainda não foi cadastrada.
export async function lerConfigPix(): Promise<ConfigPix | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("config_pix")
    .select("chave, tipo_chave, nome_recebedor, cidade, ativo")
    .maybeSingle();
  if (error) {
    console.error("[pix] falha ao ler beach.config_pix:", error.code, error.message);
    return null;
  }
  return data && isTipoChave(data.tipo_chave) ? (data as ConfigPix) : null;
}

export type CobrancaPix = { copiaECola: string; qrSvg: string; valor: number };

// Monta o copia e cola e o QR Code (SVG) de uma cobrança.
// referencia: "M" + id da mensalidade, "L" + id da locação, ou "TESTE".
export async function cobrancaPix(
  config: ConfigPix,
  valor: number,
  prefixo: string,
  id: string,
): Promise<CobrancaPix> {
  const copiaECola = gerarPixCopiaECola({
    chave: config.chave,
    nome: config.nome_recebedor,
    cidade: config.cidade,
    valor,
    txid: txidDe(prefixo, id),
  });
  const qrSvg = await QRCode.toString(copiaECola, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#1f3d26", light: "#ffffff" },
  });
  return { copiaECola, qrSvg, valor };
}
