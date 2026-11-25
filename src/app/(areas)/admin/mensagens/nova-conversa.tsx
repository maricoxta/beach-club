"use client";

import { useRouter } from "next/navigation";
import { classeCampo } from "@/components/agenda/ui";

// Equipe puxa conversa com qualquer aluno (mesmo quem nunca escreveu).
export function NovaConversa({ alunos }: { alunos: { id: string; nome: string }[] }) {
  const router = useRouter();
  return (
    <label className="flex w-full flex-col gap-1 text-sm font-semibold text-verde-900 sm:w-72">
      Nova conversa
      <select
        className={classeCampo}
        defaultValue=""
        onChange={(e) => e.target.value && router.push(`/admin/mensagens/${e.target.value}`)}
      >
        <option value="" disabled>
          Escolha um aluno…
        </option>
        {alunos.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
