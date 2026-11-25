"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Fica montado no layout da área: quando chega mensagem nova (Supabase Realtime),
// recarrega os dados do servidor, o que atualiza o contador do menu e a conversa aberta.
// O Realtime respeita o RLS: o aluno só recebe eventos da própria conversa.
export function OuvirMensagens({ alunoId }: { alunoId?: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ativo = true;
    let canal: ReturnType<typeof supabase.channel> | undefined;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!ativo || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      canal = supabase
        .channel(`chat:${alunoId ?? "equipe"}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "beach",
            table: "mensagens",
            ...(alunoId ? { filter: `aluno_id=eq.${alunoId}` } : {}),
          },
          () => {
            clearTimeout(timer);
            timer = setTimeout(() => router.refresh(), 250);
          },
        )
        .subscribe();
    })();

    return () => {
      ativo = false;
      clearTimeout(timer);
      if (canal) void supabase.removeChannel(canal);
    };
  }, [alunoId, router]);

  return null;
}
