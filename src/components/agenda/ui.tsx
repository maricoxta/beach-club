import Link from "next/link";
import { rotuloStatusAula, type StatusAula } from "@/lib/agenda/tipos";

export const classeCampo =
  "w-full rounded-2xl border-2 border-areia-200 bg-white px-3 py-2.5 text-sm text-tinta outline-none transition focus:border-verde-600";

export const classeBotao =
  "inline-flex items-center justify-center gap-2 rounded-full bg-verde-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-verde-800 disabled:opacity-60";

export const classeBotaoSecundario =
  "inline-flex items-center justify-center gap-2 rounded-full border border-areia-300 bg-white px-4 py-2 text-sm font-semibold text-verde-800 transition hover:border-verde-700";

export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: string; acoes?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-verde-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-tinta-suave">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function Cartao({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-areia-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-areia-200 bg-white/60 px-6 py-10 text-center text-sm text-tinta-suave">
      {children}
    </div>
  );
}

const corStatus: Record<StatusAula, string> = {
  agendada: "bg-verde-50 text-verde-700",
  realizada: "bg-sol-400/25 text-verde-900",
  cancelada: "bg-erro/10 text-erro line-through",
};

export function SeloStatus({ status }: { status: StatusAula }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${corStatus[status]}`}>{rotuloStatusAula[status]}</span>
  );
}

export function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-areia-100 px-2.5 py-0.5 text-xs font-semibold text-verde-900">{children}</span>
  );
}

export function BarraVagas({ ocupadas, vagas }: { ocupadas: number; vagas: number }) {
  const pct = Math.min(100, Math.round((ocupadas / vagas) * 100));
  const lotada = ocupadas >= vagas;
  return (
    <div className="flex items-center gap-2" title={`${ocupadas} de ${vagas} vagas ocupadas`}>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-areia-100">
        <div className={`h-full rounded-full ${lotada ? "bg-erro" : "bg-verde-600"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold ${lotada ? "text-erro" : "text-tinta-suave"}`}>
        {ocupadas}/{vagas}
      </span>
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: "erro" | "ok"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={`rounded-2xl px-4 py-3 text-sm font-semibold ${tipo === "erro" ? "bg-erro/10 text-erro" : "bg-verde-50 text-verde-700"}`}
    >
      {children}
    </p>
  );
}

export function LinkVoltar({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-4 inline-block text-sm font-semibold text-verde-700 hover:underline">
      ← {children}
    </Link>
  );
}
