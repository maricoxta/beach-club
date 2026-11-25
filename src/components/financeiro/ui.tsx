import Link from "next/link";
import { rotuloMes, somarMeses } from "@/lib/financeiro";

// Navegação entre meses preservando os demais filtros da URL.
export function NavegarMes({
  mes,
  base,
  params = {},
}: {
  mes: string;
  base: string;
  params?: Record<string, string>;
}) {
  const href = (m: string) => `${base}?${new URLSearchParams({ ...params, mes: m }).toString()}`;
  const seta =
    "grid h-9 w-9 place-items-center rounded-full border border-areia-300 bg-white text-lg font-bold text-verde-800 transition hover:border-verde-700 hover:bg-verde-50";
  return (
    <div className="flex items-center gap-2">
      <Link href={href(somarMeses(mes, -1))} className={seta} aria-label="Mês anterior">
        ‹
      </Link>
      <span className="min-w-44 text-center font-display text-lg font-semibold capitalize text-verde-900">
        {rotuloMes(mes)}
      </span>
      <Link href={href(somarMeses(mes, 1))} className={seta} aria-label="Próximo mês">
        ›
      </Link>
    </div>
  );
}

const coresIndicador = {
  verde: "border-verde-600/30 bg-verde-50",
  sol: "border-sol-400/50 bg-sol-400/15",
  erro: "border-erro/25 bg-erro/5",
  neutro: "border-areia-200 bg-white",
} as const;

export function Indicador({
  rotulo,
  valor,
  detalhe,
  cor = "neutro",
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  cor?: keyof typeof coresIndicador;
}) {
  return (
    <div className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${coresIndicador[cor]}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">{rotulo}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-verde-900">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-tinta-suave">{detalhe}</p>}
    </div>
  );
}

// Barra horizontal simples (relatórios): proporção de "parte" sobre "total".
export function Barra({ parte, total, cor = "bg-verde-600" }: { parte: number; total: number; cor?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((parte / total) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-areia-100" role="presentation">
      <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
