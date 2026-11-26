// Parceiros do clube e vouchers para alunos (tabela beach.parceiros).
export const BUCKET_LOGOS = "beach-parceiros";

export type Parceiro = {
  id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  beneficio: string | null;
  codigo: string | null;
  como_usar: string | null;
  validade: string | null;
  link: string | null;
  contato: string | null;
  endereco: string | null;
  logo_path: string | null;
  ativo: boolean;
  ordem: number;
};

export const COLUNAS_PARCEIRO =
  "id, nome, categoria, descricao, beneficio, codigo, como_usar, validade, link, contato, endereco, logo_path, ativo, ordem";

// Bucket público: a URL do logo é fixa e não expira.
export function urlLogo(caminho: string | null) {
  if (!caminho) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/${BUCKET_LOGOS}/${caminho}` : null;
}

// Contato pode ser telefone/WhatsApp, @instagram ou e-mail: vira link quando dá.
export function linkContato(contato: string | null): string | null {
  if (!contato) return null;
  const c = contato.trim();
  if (/^@[\w.]{1,30}$/.test(c)) return `https://instagram.com/${c.slice(1)}`;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return `mailto:${c}`;
  const digitos = c.replace(/\D/g, "");
  if (/^[\d\s()+-]+$/.test(c) && digitos.length >= 10 && digitos.length <= 13) {
    return `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}`;
  }
  return null;
}

export function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
