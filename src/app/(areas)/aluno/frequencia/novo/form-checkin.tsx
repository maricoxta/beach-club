"use client";

import { startTransition, useActionState, useState } from "react";
import { IconeAtividade } from "@/components/frequencia/icone-atividade";
import { Alerta, Campo, classeBotao, classeCampo } from "@/components/ui";
import { BUCKET_FOTOS, INFO_TIPO, TIPOS_ATIVIDADE } from "@/lib/frequencia";
import { criarCheckin, type EstadoCheckin } from "@/lib/frequencia-acoes";
import { createClient } from "@/lib/supabase/client";

const LADO_MAX = 1280;

// Reduz a foto no navegador (celular gera arquivos de 3–8 MB). Se o navegador
// não conseguir decodificar (ex.: HEIC fora do Safari), envia o arquivo original.
async function reduzirFoto(arquivo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    return blob ?? arquivo;
  } catch {
    return arquivo;
  }
}

export function FormCheckin({
  alunoId,
  dataInicial,
  dataMaxima,
}: {
  alunoId: string;
  dataInicial: string;
  dataMaxima: string;
}) {
  const [estado, despachar, salvando] = useActionState<EstadoCheckin, FormData>(criarCheckin, undefined);
  const [tipo, setTipo] = useState<string>("");
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  function escolherFoto(arquivo: File | null) {
    if (previa) URL.revokeObjectURL(previa);
    setFoto(arquivo);
    setPrevia(arquivo ? URL.createObjectURL(arquivo) : null);
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroLocal(null);
    const form = new FormData(e.currentTarget);
    form.delete("foto");
    if (!tipo) return setErroLocal("Escolha qual foi a atividade.");

    if (foto) {
      setEnviandoFoto(true);
      const blob = await reduzirFoto(foto);
      if (blob.size > 5 * 1024 * 1024) {
        setEnviandoFoto(false);
        return setErroLocal("A foto é muito grande (máximo 5 MB).");
      }
      const ext = blob.type === "image/jpeg" ? "jpg" : (foto.name.split(".").pop() ?? "jpg").toLowerCase();
      const caminho = `${alunoId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient()
        .storage.from(BUCKET_FOTOS)
        .upload(caminho, blob, { contentType: blob.type || foto.type, upsert: false });
      setEnviandoFoto(false);
      if (error) {
        console.error("[checkin] upload:", error.message);
        return setErroLocal("Não foi possível enviar a foto. Tente de novo ou salve sem foto.");
      }
      form.set("foto_path", caminho);
    }
    startTransition(() => despachar(form));
  }

  const ocupado = salvando || enviandoFoto;
  const erro = erroLocal ?? estado?.erro;

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      {/* Foto */}
      <label className="group relative grid aspect-[4/3] w-full cursor-pointer place-items-center overflow-hidden rounded-3xl border-2 border-dashed border-areia-300 bg-areia-50 text-center transition hover:border-verde-600">
        {previa ? (
          // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:)
          <img src={previa} alt="Prévia da foto" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 px-6 text-sm text-tinta-suave">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-2xl text-verde-700 shadow-sm">📷</span>
            <span className="font-bold text-verde-900">Adicionar foto</span>
            <span>Opcional. Tire na hora ou escolha da galeria.</span>
          </span>
        )}
        {previa && (
          <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-verde-900 shadow">
            Trocar foto
          </span>
        )}
        <input
          type="file"
          name="foto"
          accept="image/*"
          className="sr-only"
          onChange={(e) => escolherFoto(e.currentTarget.files?.[0] ?? null)}
        />
      </label>
      {foto && (
        <button type="button" onClick={() => escolherFoto(null)} className="-mt-3 self-end text-xs font-semibold text-erro hover:underline">
          Remover foto
        </button>
      )}

      {/* Atividade */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-verde-900">Qual foi a atividade?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TIPOS_ATIVIDADE.map((t) => (
            <label
              key={t}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white px-3 py-2.5 text-sm font-bold transition ${
                tipo === t ? "border-verde-600 bg-verde-50 text-verde-900" : "border-areia-200 text-verde-900 hover:border-areia-300"
              }`}
            >
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
              <IconeAtividade tipo={t} className="h-9 w-9" />
              {INFO_TIPO[t].rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <Campo rotulo="Data">
        <input type="date" name="data" defaultValue={dataInicial} max={dataMaxima} required className={classeCampo} />
      </Campo>

      <div className="rounded-3xl border border-areia-200 bg-white p-4 sm:p-5">
        <p className="mb-3 text-sm font-semibold text-verde-900">
          Métricas <span className="font-normal text-tinta-suave">(opcionais, do seu relógio ou app)</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Tempo de exercício" className="col-span-2">
            <div className="flex items-center gap-2">
              <input type="number" name="horas" min={0} max={24} inputMode="numeric" placeholder="0" className={classeCampo} aria-label="Horas" />
              <span className="text-sm text-tinta-suave">h</span>
              <input type="number" name="minutos" min={0} max={59} inputMode="numeric" placeholder="0" className={classeCampo} aria-label="Minutos" />
              <span className="text-sm text-tinta-suave">min</span>
            </div>
          </Campo>
          <Campo rotulo="Distância (km)">
            <input type="text" name="distancia_km" inputMode="decimal" placeholder="Ex.: 2,5" className={classeCampo} />
          </Campo>
          <Campo rotulo="Calorias (kcal)">
            <input type="number" name="calorias" min={0} inputMode="numeric" placeholder="Ex.: 450" className={classeCampo} />
          </Campo>
          <Campo rotulo="Passos" className="col-span-2 sm:col-span-1">
            <input type="number" name="passos" min={0} inputMode="numeric" placeholder="Ex.: 6000" className={classeCampo} />
          </Campo>
        </div>
      </div>

      <Campo rotulo="Observação (opcional)">
        <textarea name="observacao" rows={2} maxLength={500} placeholder="Como foi o treino?" className={classeCampo} />
      </Campo>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      <button type="submit" disabled={ocupado} className={`${classeBotao} py-3 text-base`}>
        {enviandoFoto ? "Enviando foto…" : salvando ? "Salvando…" : "Registrar check-in"}
      </button>
    </form>
  );
}
