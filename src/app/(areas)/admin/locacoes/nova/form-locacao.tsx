"use client";

import { useState } from "react";
import { FormAcao, type Acao } from "@/components/form-acao";
import { Campo, classeCampo } from "@/components/ui";
import { moeda } from "@/lib/formato";
import { FORMAS_PAGAMENTO, HORA_ABRE, HORA_FECHA, MAX_HORAS, rotuloForma } from "@/lib/locacoes/regras";

type Quadra = { id: string; nome: string; valor_hora: number };
type Aluno = { id: string; nome: string; telefone: string | null };

export function FormLocacao({
  acao,
  quadras,
  alunos,
  inicial,
}: {
  acao: Acao;
  quadras: Quadra[];
  alunos: Aluno[];
  inicial: { quadra: string; data: string; hora: number };
}) {
  const [quadraId, setQuadraId] = useState(inicial.quadra);
  const [hora, setHora] = useState(inicial.hora);
  const [horas, setHoras] = useState(1);
  const [alunoId, setAlunoId] = useState("");
  const [valorHora, setValorHora] = useState("");
  const [pagar, setPagar] = useState(false);

  const quadra = quadras.find((q) => q.id === quadraId);
  const valor = valorHora.trim() ? Number(valorHora.replace(/\./g, "").replace(",", ".")) : (quadra?.valor_hora ?? 0);
  const total = Number.isFinite(valor) ? valor * horas : 0;
  const maxHoras = Math.min(MAX_HORAS, HORA_FECHA - hora);
  const aluno = alunos.find((a) => a.id === alunoId);

  return (
    <FormAcao acao={acao} rotulo="Reservar quadra" rotuloPendente="Reservando…" className="flex flex-col gap-5">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-bold text-verde-900">Quando e onde</legend>
        <Campo rotulo="Quadra">
          <select name="quadra_id" required value={quadraId} onChange={(e) => setQuadraId(e.target.value)} className={classeCampo}>
            {quadras.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nome} · {moeda(q.valor_hora)}/h
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Data">
          <input type="date" name="data" required defaultValue={inicial.data} className={classeCampo} />
        </Campo>
        <Campo rotulo="Início">
          <select
            name="hora"
            value={hora}
            onChange={(e) => {
              const h = Number(e.target.value);
              setHora(h);
              setHoras((atual) => Math.min(atual, HORA_FECHA - h));
            }}
            className={classeCampo}
          >
            {Array.from({ length: HORA_FECHA - HORA_ABRE }, (_, i) => HORA_ABRE + i).map((h) => (
              <option key={h} value={h}>
                {h}h
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Duração" dica={`Termina às ${hora + horas}h. Locação em horas cheias.`}>
          <select name="horas" value={horas} onChange={(e) => setHoras(Number(e.target.value))} className={classeCampo}>
            {Array.from({ length: maxHoras }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} hora{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </Campo>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-bold text-verde-900">Cliente</legend>
        <Campo rotulo="É aluno do clube?" className="sm:col-span-2" dica="Opcional. Para quem não é aluno, preencha nome e telefone.">
          <select name="aluno_id" value={alunoId} onChange={(e) => setAlunoId(e.target.value)} className={classeCampo}>
            <option value="">Não, cliente avulso</option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Nome">
          <input
            name="cliente_nome"
            required={!alunoId}
            placeholder={aluno ? aluno.nome : "Nome de quem reservou"}
            className={classeCampo}
          />
        </Campo>
        <Campo rotulo="Telefone / WhatsApp">
          <input
            name="cliente_telefone"
            type="tel"
            inputMode="tel"
            placeholder={aluno?.telefone ?? "(00) 00000-0000"}
            className={classeCampo}
          />
        </Campo>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-bold text-verde-900">Valor e pagamento</legend>
        <Campo rotulo="Valor por hora (R$)" dica={`Em branco usa o preço da quadra (${moeda(quadra?.valor_hora)}).`}>
          <input
            name="valor_hora"
            inputMode="decimal"
            value={valorHora}
            onChange={(e) => setValorHora(e.target.value)}
            placeholder={String(quadra?.valor_hora ?? "")}
            className={classeCampo}
          />
        </Campo>
        <div className="flex flex-col justify-center rounded-2xl bg-areia-50 px-4 py-3">
          <span className="text-xs font-semibold text-tinta-suave">Total</span>
          <span className="font-display text-2xl font-bold text-verde-900">{moeda(total)}</span>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-verde-900 sm:col-span-2">
          <input
            type="checkbox"
            name="pagar_agora"
            value="1"
            checked={pagar}
            onChange={(e) => setPagar(e.target.checked)}
            className="h-4 w-4 accent-verde-700"
          />
          Já recebi o pagamento total
        </label>
        {pagar && (
          <Campo rotulo="Forma de pagamento">
            <select name="forma" required defaultValue="pix" className={classeCampo}>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>
                  {rotuloForma[f]}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo rotulo="Observação" className="sm:col-span-2">
          <textarea name="observacao" rows={2} placeholder="Opcional" className={classeCampo} />
        </Campo>
      </fieldset>
    </FormAcao>
  );
}
