"use client";

import { startTransition, useActionState, useState } from "react";
import { Alerta, Campo, classeBotao, classeCampo } from "@/components/ui";
import { BUCKET_LOGOS, urlLogo, type Parceiro } from "@/lib/parceiros";
import type { EstadoParceiro } from "@/lib/parceiros-acoes";
import { createClient } from "@/lib/supabase/client";

const LADO_MAX = 512;

// Reduz o logo no navegador e mantém transparência (WebP). Se não decodificar, envia o original.
async function reduzirLogo(arquivo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.9));
    return blob && blob.type === "image/webp" ? blob : arquivo;
  } catch {
    return arquivo;
  }
}

export function FormParceiro({
  acao,
  parceiro,
}: {
  acao: (e: EstadoParceiro, f: FormData) => Promise<EstadoParceiro>;
  parceiro?: Parceiro;
}) {
  const [estado, despachar, salvando] = useActionState(acao, undefined);
  const [logoPath, setLogoPath] = useState<string | null>(parceiro?.logo_path ?? null);
  const [previa, setPrevia] = useState<string | null>(urlLogo(parceiro?.logo_path ?? null));
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  async function escolherLogo(arquivo: File | null) {
    setErroLocal(null);
    if (!arquivo) return;
    setEnviandoLogo(true);
    const blob = await reduzirLogo(arquivo);
    if (!["image/webp", "image/png", "image/jpeg"].includes(blob.type) || blob.size > 2 * 1024 * 1024) {
      setEnviandoLogo(false);
      return setErroLocal("Use uma imagem PNG, JPG ou WebP de até 2 MB.");
    }
    const ext = blob.type.split("/")[1]!.replace("jpeg", "jpg");
    const caminho = `${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient()
      .storage.from(BUCKET_LOGOS)
      .upload(caminho, blob, { contentType: blob.type, upsert: false });
    setEnviandoLogo(false);
    if (error) {
      console.error("[parceiros] upload:", error.message);
      return setErroLocal("Não foi possível enviar o logo. Tente de novo.");
    }
    setLogoPath(caminho);
    setPrevia(URL.createObjectURL(blob));
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.delete("logo");
    form.set("logo_path", logoPath ?? "");
    startTransition(() => despachar(form));
  }

  const erro = erroLocal ?? estado?.erro;

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
      <div className="flex items-center gap-4 sm:col-span-2">
        <label className="grid h-20 w-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-areia-300 bg-areia-50 text-xs font-semibold text-tinta-suave transition hover:border-verde-600">
          {previa ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local ou Storage público
            <img src={previa} alt="Logo" className="h-full w-full object-contain p-1.5" />
          ) : (
            <span className="px-2 text-center">{enviandoLogo ? "Enviando…" : "Logo"}</span>
          )}
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => escolherLogo(e.currentTarget.files?.[0] ?? null)}
          />
        </label>
        <div className="text-sm text-tinta-suave">
          <p className="font-semibold text-verde-900">{enviandoLogo ? "Enviando logo…" : "Clique no quadro para enviar o logo"}</p>
          <p>PNG com fundo transparente fica melhor. Opcional.</p>
          {logoPath && (
            <button
              type="button"
              onClick={() => {
                setLogoPath(null);
                setPrevia(null);
              }}
              className="mt-1 text-xs font-semibold text-erro hover:underline"
            >
              Remover logo
            </button>
          )}
        </div>
      </div>

      <Campo rotulo="Nome do parceiro">
        <input name="nome" required maxLength={80} defaultValue={parceiro?.nome} placeholder="Ex.: Sushi Gourmet" className={classeCampo} />
      </Campo>
      <Campo rotulo="Categoria" dica="Ex.: Restaurante, Moda praia, Fisioterapia">
        <input name="categoria" maxLength={40} defaultValue={parceiro?.categoria ?? ""} className={classeCampo} />
      </Campo>
      <Campo rotulo="Benefício do voucher" dica="O destaque do cartão. Obrigatório para publicar." className="sm:col-span-2">
        <input name="beneficio" maxLength={200} defaultValue={parceiro?.beneficio ?? ""} placeholder="Ex.: desconto na conta para alunos do clube" className={classeCampo} />
      </Campo>
      <Campo rotulo="Código do voucher" dica="Se houver. O aluno terá um botão para copiar.">
        <input name="codigo" maxLength={60} defaultValue={parceiro?.codigo ?? ""} className={`${classeCampo} font-mono uppercase`} />
      </Campo>
      <Campo rotulo="Válido até" dica="Em branco = sem prazo. Depois da data, some para os alunos.">
        <input type="date" name="validade" defaultValue={parceiro?.validade ?? ""} className={classeCampo} />
      </Campo>
      <Campo rotulo="Como usar" className="sm:col-span-2">
        <textarea name="como_usar" rows={3} maxLength={600} defaultValue={parceiro?.como_usar ?? ""} placeholder="Ex.: mostrar o app do clube no caixa e informar o código" className={classeCampo} />
      </Campo>
      <Campo rotulo="Sobre o parceiro" className="sm:col-span-2">
        <textarea name="descricao" rows={2} maxLength={600} defaultValue={parceiro?.descricao ?? ""} className={classeCampo} />
      </Campo>
      <Campo rotulo="Site ou Instagram (link)">
        <input name="link" maxLength={300} defaultValue={parceiro?.link ?? ""} placeholder="https://" className={classeCampo} />
      </Campo>
      <Campo rotulo="Contato" dica="WhatsApp, @instagram ou e-mail: vira link para o aluno.">
        <input name="contato" maxLength={120} defaultValue={parceiro?.contato ?? ""} className={classeCampo} />
      </Campo>
      <Campo rotulo="Endereço">
        <input name="endereco" maxLength={200} defaultValue={parceiro?.endereco ?? ""} className={classeCampo} />
      </Campo>
      <Campo rotulo="Ordem na lista" dica="Menor aparece primeiro.">
        <input type="number" name="ordem" min={0} max={999} defaultValue={parceiro?.ordem ?? 0} className={classeCampo} />
      </Campo>

      <label className="flex items-center gap-2 text-sm font-semibold text-verde-900 sm:col-span-2">
        <input type="checkbox" name="ativo" value="1" defaultChecked={parceiro?.ativo ?? false} className="h-4 w-4 accent-verde-700" />
        Publicar para os alunos
      </label>

      <div className="flex flex-col gap-3 sm:col-span-2">
        {erro && <Alerta tipo="erro">{erro}</Alerta>}
        {estado?.ok && !erroLocal && <Alerta tipo="ok">{estado.ok}</Alerta>}
        <button disabled={salvando || enviandoLogo} className={`${classeBotao} w-fit`}>
          {salvando ? "Salvando…" : parceiro ? "Salvar" : "Cadastrar parceiro"}
        </button>
      </div>
    </form>
  );
}
