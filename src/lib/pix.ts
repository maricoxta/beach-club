// "Pix copia e cola" estático (BR Code do Banco Central, padrão EMV QRCPS-MPM).
// Funções puras: rodam no servidor e no navegador, sem dependências.
//
// O código é uma sequência de campos ID (2 dígitos) + tamanho (2 dígitos) + valor.
// O último campo (63) é um CRC16 de tudo o que vem antes, que o app do banco confere.

export const TIPOS_CHAVE = {
  cnpj: "CNPJ",
  cpf: "CPF",
  email: "E-mail",
  telefone: "Celular",
  aleatoria: "Chave aleatória",
} as const;
export type TipoChave = keyof typeof TIPOS_CHAVE;

export function isTipoChave(v: string): v is TipoChave {
  return v in TIPOS_CHAVE;
}

export type ConfigPix = {
  chave: string;
  tipo_chave: TipoChave;
  nome_recebedor: string;
  cidade: string;
  ativo: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Deixa a chave no formato que o DICT (diretório do Pix) usa. Retorna null se for inválida.
export function normalizarChave(tipo: TipoChave, bruta: string): string | null {
  const v = bruta.trim();
  const digitos = v.replace(/\D/g, "");
  switch (tipo) {
    case "cnpj":
      return digitos.length === 14 ? digitos : null;
    case "cpf":
      return digitos.length === 11 ? digitos : null;
    case "telefone": {
      // Aceita "(21) 99999-9999", "21999999999" ou "+55 21 99999-9999".
      const nacional = digitos.length === 13 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
      return nacional.length === 10 || nacional.length === 11 ? `+55${nacional}` : null;
    }
    case "email": {
      const e = v.toLowerCase();
      return EMAIL.test(e) && e.length <= 77 ? e : null;
    }
    case "aleatoria": {
      const a = v.toLowerCase();
      return UUID.test(a) ? a : null;
    }
  }
}

// O BR Code só aceita ASCII; nome até 25 e cidade até 15 caracteres.
export function textoPix(valor: string, max: number) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,&-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim();
}

// Identificador da cobrança (txid): só letras e números, até 25. Aparece no extrato
// do clube em muitos bancos e ajuda a recepção a achar de quem é o pagamento.
export function txidDe(prefixo: string, id: string) {
  return `${prefixo}${id.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 25).toUpperCase();
}

function campo(id: string, valor: string) {
  if (valor.length > 99) throw new Error(`Campo ${id} do Pix maior que 99 caracteres.`);
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

// CRC16/CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF), exigido pelo Banco Central.
export function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function gerarPixCopiaECola({
  chave,
  nome,
  cidade,
  valor,
  txid,
}: {
  chave: string;
  nome: string;
  cidade: string;
  valor?: number | null;
  txid?: string | null;
}) {
  const nomePix = textoPix(nome, 25);
  const cidadePix = textoPix(cidade, 15);
  if (!chave || !nomePix || !cidadePix) throw new Error("Chave Pix, nome e cidade são obrigatórios.");

  const conta = campo("00", "br.gov.bcb.pix") + campo("01", chave);
  const partes = [
    campo("00", "01"),
    campo("26", conta),
    campo("52", "0000"),
    campo("53", "986"), // real
  ];
  if (valor != null && valor > 0) partes.push(campo("54", valor.toFixed(2)));
  partes.push(
    campo("58", "BR"),
    campo("59", nomePix),
    campo("60", cidadePix),
    campo("62", campo("05", txid?.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***")),
  );
  const semCrc = `${partes.join("")}6304`;
  return semCrc + crc16(semCrc);
}
