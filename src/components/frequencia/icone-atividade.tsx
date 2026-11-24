import { INFO_TIPO, type Esporte, type TipoAtividade } from "@/lib/frequencia";

// Ícones desenhados à mão (traço), para não depender de biblioteca.
function Desenho({ esporte }: { esporte: Esporte }) {
  if (esporte === "beach_tenis") {
    // Raquete de beach tênis (cabeça oval com furos + cabo) e bolinha.
    return (
      <>
        <ellipse cx="10" cy="9" rx="5.6" ry="6.2" transform="rotate(-35 10 9)" />
        <path d="M13.6 13.4 18.6 19.2" strokeWidth="2.6" />
        <circle cx="8.6" cy="7.6" r=".6" fill="currentColor" stroke="none" />
        <circle cx="11.2" cy="8.2" r=".6" fill="currentColor" stroke="none" />
        <circle cx="9.4" cy="10.4" r=".6" fill="currentColor" stroke="none" />
        <circle cx="19" cy="5" r="1.8" />
      </>
    );
  }
  if (esporte === "volei") {
    // Bola de vôlei.
    return (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5c-1.2 3.6-.6 6.6 1.6 8.5M20.4 13.2c-3.6-.8-6.6.2-8.4 2.6M5.2 17.6c2.4-2.8 3.4-5.8 2.6-9.4" />
      </>
    );
  }
  // Futvôlei: bola com gomos de futebol.
  return (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.2l3 2.2-1.1 3.6h-3.8L9 10.4z" fill="currentColor" stroke="none" />
      <path d="M12 8.2V3.6M15 10.4l4.3-1.4M13.9 14l2.6 3.8M10.1 14l-2.6 3.8M9 10.4 4.7 9" />
    </>
  );
}

const cores = {
  aula: "bg-verde-700 text-white",
  play: "bg-sol-400 text-verde-900",
};

// Selo redondo com o ícone da atividade. Aula = verde, play = amarelo.
export function IconeAtividade({ tipo, className = "h-10 w-10" }: { tipo: TipoAtividade; className?: string }) {
  const info = INFO_TIPO[tipo];
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full ${info.aula ? cores.aula : cores.play} ${className}`}
      title={info.rotulo}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[62%] w-[62%]"
        aria-hidden
      >
        <Desenho esporte={info.esporte} />
      </svg>
    </span>
  );
}
