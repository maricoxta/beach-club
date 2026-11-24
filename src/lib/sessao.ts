import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { areaDoPapel, isPapel, rotaDoPapel, type Area, type Papel } from "@/lib/papel";

export type Perfil = {
  id: string;
  nome: string;
  email: string | null;
  papel: Papel;
  ativo: boolean;
};

// Usuário logado + perfil em beach.perfis (memoizado por request).
export const getSessao = cache(async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { user: null, perfil: null } as const;

  const { data } = await supabase
    .from("perfis")
    .select("id, nome, email, papel, ativo")
    .eq("id", auth.user.id)
    .maybeSingle();

  const perfil = data && isPapel(data.papel) ? (data as Perfil) : null;
  return { user: auth.user, perfil } as const;
});

// Usado no layout de cada área: garante login, perfil ativo e papel compatível.
export async function exigirArea(area: Area): Promise<Perfil> {
  const { user, perfil } = await getSessao();
  if (!user) redirect("/login");
  if (!perfil || !perfil.ativo) redirect("/sem-acesso");
  if (areaDoPapel(perfil.papel) !== area) redirect(rotaDoPapel(perfil.papel));
  return perfil;
}
