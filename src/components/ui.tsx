// Peças de formulário e layout reaproveitadas nas telas internas.

export const classeCampo =
  "w-full rounded-2xl border-2 border-areia-200 bg-white px-4 py-2.5 text-tinta outline-none transition placeholder:text-tinta-suave/60 focus:border-verde-600 disabled:bg-areia-50";

export const classeBotao =
  "rounded-full bg-verde-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-verde-800 disabled:opacity-60";

export const classeBotaoSecundario =
  "rounded-full border border-areia-300 bg-white px-4 py-2 text-sm font-semibold text-verde-800 transition hover:border-verde-700 hover:bg-verde-50 disabled:opacity-60";

export const classeBotaoPerigo =
  "rounded-full border border-erro/30 bg-white px-4 py-2 text-sm font-semibold text-erro transition hover:bg-erro/10 disabled:opacity-60";

export function Campo({
  rotulo,
  dica,
  children,
  className = "",
}: {
  rotulo: string;
  dica?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-semibold text-verde-900 ${className}`}>
      {rotulo}
      {children}
      {dica && <span className="text-xs font-normal text-tinta-suave">{dica}</span>}
    </label>
  );
}

export function Alerta({ tipo, children }: { tipo: "erro" | "ok"; children: React.ReactNode }) {
  return tipo === "erro" ? (
    <p role="alert" className="rounded-2xl bg-erro/10 px-4 py-3 text-sm font-semibold text-erro">
      {children}
    </p>
  ) : (
    <p role="status" className="rounded-2xl bg-verde-50 px-4 py-3 text-sm font-semibold text-verde-700">
      {children}
    </p>
  );
}

export function Painel({
  titulo,
  acao,
  children,
  className = "",
}: {
  titulo?: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-areia-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      {(titulo || acao) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {titulo && <h2 className="font-display text-xl font-bold text-verde-900">{titulo}</h2>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

const coresSelo = {
  verde: "bg-verde-50 text-verde-700",
  sol: "bg-sol-400/25 text-verde-900",
  cinza: "bg-areia-100 text-tinta-suave",
  erro: "bg-erro/10 text-erro",
} as const;

export function Selo({ cor, children }: { cor: keyof typeof coresSelo; children: React.ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${coresSelo[cor]}`}>
      {children}
    </span>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border-2 border-dashed border-areia-200 px-4 py-8 text-center text-sm text-tinta-suave">
      {children}
    </p>
  );
}
