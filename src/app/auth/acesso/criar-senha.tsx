"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alerta, Campo, classeBotao, classeCampo } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Etapa = "validando" | "senha" | "invalido";

// O link chega com os tokens no #hash (fluxo implícito). Guardamos a sessão em cookies e pedimos uma senha.
export function CriarSenha() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("validando");
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    // Tira os tokens da barra de endereço.
    window.history.replaceState(null, "", window.location.pathname);

    const supabase = createClient();
    const sessao =
      access_token && refresh_token
        ? supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => !error)
        : supabase.auth.getUser().then(({ data }) => Boolean(data.user));
    sessao.then((ok) => setEtapa(ok ? "senha" : "invalido"));
  }, []);

  async function salvar(form: FormData) {
    const senha = String(form.get("senha") ?? "");
    const confirmacao = String(form.get("confirmacao") ?? "");
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== confirmacao) return setErro("As senhas não conferem.");
    setSalvando(true);
    setErro(undefined);
    const { error } = await createClient().auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      return setErro(
        error.code === "same_password" ? "Use uma senha diferente da anterior." : "Não foi possível salvar a senha.",
      );
    }
    router.replace("/");
    router.refresh();
  }

  if (etapa === "validando") return <p className="text-tinta-suave">Validando seu link…</p>;

  if (etapa === "invalido") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-semibold text-verde-900">Link expirado</h1>
        <p className="text-tinta-suave">
          Este link já foi usado ou expirou. Peça um novo para a recepção ou entre com sua senha.
        </p>
        <Link href="/login" className={`${classeBotao} text-center`}>
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={salvar} className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-verde-900">Crie sua senha</h1>
        <p className="mt-1 text-sm text-tinta-suave">Você vai usar o seu e-mail e esta senha para entrar.</p>
      </div>
      <Campo rotulo="Nova senha">
        <input name="senha" type="password" autoComplete="new-password" minLength={8} required className={classeCampo} />
      </Campo>
      <Campo rotulo="Repita a senha">
        <input name="confirmacao" type="password" autoComplete="new-password" required className={classeCampo} />
      </Campo>
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      <button type="submit" disabled={salvando} className={classeBotao}>
        {salvando ? "Salvando…" : "Salvar e entrar"}
      </button>
      <Link href="/" className="text-center text-sm font-semibold text-verde-700 hover:underline">
        Pular por enquanto
      </Link>
    </form>
  );
}
