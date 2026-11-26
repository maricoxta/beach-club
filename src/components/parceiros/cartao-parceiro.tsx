import { BotaoCopiar } from "@/components/pix/botao-copiar";
import { Selo } from "@/components/ui";
import { data } from "@/lib/formato";
import { iniciais, linkContato, urlLogo, type Parceiro } from "@/lib/parceiros";

function Logo({ parceiro }: { parceiro: Parceiro }) {
  const src = urlLogo(parceiro.logo_path);
  return (
    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-areia-200 bg-white">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo no Storage público do Supabase
        <img src={src} alt={`Logo ${parceiro.nome}`} className="h-full w-full object-contain p-1.5" />
      ) : (
        <span className="font-display text-xl font-bold text-verde-700">{iniciais(parceiro.nome)}</span>
      )}
    </div>
  );
}

// Cartão do parceiro como o aluno vê (também usado como prévia na administração).
export function CartaoParceiro({ parceiro }: { parceiro: Parceiro }) {
  const contato = linkContato(parceiro.contato);
  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-areia-200 bg-white shadow-sm">
      <div className="flex items-center gap-4 p-5 pb-4">
        <Logo parceiro={parceiro} />
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold text-verde-900">{parceiro.nome}</h2>
          {parceiro.categoria && <p className="text-sm text-tinta-suave">{parceiro.categoria}</p>}
        </div>
      </div>

      {parceiro.beneficio && (
        <div className="mx-5 rounded-2xl bg-sol-400/20 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-verde-700">Seu benefício</p>
          <p className="mt-0.5 font-display text-lg font-bold leading-snug text-verde-900">{parceiro.beneficio}</p>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5 text-sm text-tinta">
        {parceiro.descricao && <p className="text-tinta-suave">{parceiro.descricao}</p>}

        {parceiro.codigo && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-verde-600/40 bg-verde-50 px-4 py-3">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-verde-700">Código do voucher</p>
              <p className="font-mono text-lg font-bold tracking-wider text-verde-900">{parceiro.codigo}</p>
            </div>
            <BotaoCopiar texto={parceiro.codigo} rotulo="Copiar" />
          </div>
        )}

        {parceiro.como_usar && (
          <div>
            <p className="font-semibold text-verde-900">Como usar</p>
            <p className="whitespace-pre-line text-tinta-suave">{parceiro.como_usar}</p>
          </div>
        )}

        {parceiro.endereco && <p className="text-tinta-suave">📍 {parceiro.endereco}</p>}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {parceiro.validade ? (
            <Selo cor="sol">Válido até {data(parceiro.validade)}</Selo>
          ) : (
            <Selo cor="verde">Sem prazo</Selo>
          )}
          {parceiro.link && (
            <a href={parceiro.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-verde-700 hover:underline">
              Site ↗
            </a>
          )}
          {parceiro.contato &&
            (contato ? (
              <a href={contato} target="_blank" rel="noopener noreferrer" className="font-semibold text-verde-700 hover:underline">
                {parceiro.contato}
              </a>
            ) : (
              <span className="text-tinta-suave">{parceiro.contato}</span>
            ))}
        </div>
      </div>
    </article>
  );
}
