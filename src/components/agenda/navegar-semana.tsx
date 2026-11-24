import Link from "next/link";
import { formatarData, inicioDaSemana, somarDias } from "@/lib/agenda/datas";
import { classeBotaoSecundario } from "./ui";

// "hoje" vem da página (que já leu dados dinâmicos), para não chamar new Date() durante o prerender.
export function NavegarSemana({ segunda, base, hoje }: { segunda: string; base: string; hoje: string }) {
  const domingo = somarDias(segunda, 6);
  const atual = inicioDaSemana(hoje);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link className={classeBotaoSecundario} href={`${base}?semana=${somarDias(segunda, -7)}`} aria-label="Semana anterior">
        ←
      </Link>
      <span className="min-w-36 text-center font-display font-semibold text-verde-900">
        {formatarData(segunda)} a {formatarData(domingo)}
      </span>
      <Link className={classeBotaoSecundario} href={`${base}?semana=${somarDias(segunda, 7)}`} aria-label="Próxima semana">
        →
      </Link>
      {segunda !== atual && (
        <Link className={classeBotaoSecundario} href={base}>
          Hoje
        </Link>
      )}
    </div>
  );
}
