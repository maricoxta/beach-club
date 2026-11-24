"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoForm = { erro?: string; aviso?: string } | undefined;

function texto(form: FormData, campo: string) {
  return String(form.get(campo) ?? "").trim();
}

export async function entrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const email = texto(form, "email");
  const senha = texto(form, "senha");
  if (!email || !senha) return { erro: "Informe e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    return {
      erro:
        error.code === "email_not_confirmed"
          ? "Confirme seu e-mail antes de entrar."
          : "E-mail ou senha incorretos.",
    };
  }
  // A home decide a área certa pelo papel do perfil.
  redirect("/");
}

export async function cadastrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const nome = texto(form, "nome");
  const email = texto(form, "email");
  const senha = texto(form, "senha");
  if (!nome || !email) return { erro: "Informe nome e e-mail." };
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };

  const h = await headers();
  const origem = process.env.NEXT_PUBLIC_SITE_URL ?? h.get("origin") ?? `https://${h.get("host")}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      emailRedirectTo: `${origem}/auth/callback`,
      // "app" faz o trigger do banco criar o perfil em beach.perfis (como aluno).
      // O auth.users é compartilhado com outros apps deste projeto Supabase.
      data: { app: "beach-club", nome },
    },
  });
  if (error) return { erro: error.message };

  if (data.session) redirect("/");
  return { aviso: "Conta criada! Enviamos um link de confirmação para o seu e-mail." };
}
