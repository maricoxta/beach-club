import { marca } from "@/lib/marca";

export function LogoMarca({ className = "h-10 w-10", claro = false }: { className?: string; claro?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill={claro ? "var(--mar-600)" : "var(--mar-900)"} />
      <clipPath id="logo-clip">
        <circle cx="24" cy="24" r="24" />
      </clipPath>
      <g clipPath="url(#logo-clip)">
      <circle cx="24" cy="21" r="9" fill="var(--sol-400)" />
      <path d="M4 30 Q10 25 16 30 T28 30 T40 30 T52 30 V48 H4Z" fill="var(--mar-500)" />
      <path d="M0 36 Q7 31 14 36 T28 36 T42 36 T56 36 V48 H0Z" fill="var(--areia-200)" />
      </g>
    </svg>
  );
}

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMarca claro={claro} />
      <span
        className={`font-display text-xl font-extrabold tracking-tight ${claro ? "text-areia-50" : "text-mar-900"}`}
      >
        {marca.nome}
      </span>
    </span>
  );
}
