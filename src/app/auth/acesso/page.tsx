import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { CriarSenha } from "./criar-senha";

export const metadata: Metadata = { title: "Acessar" };

// Destino do link de acesso que a recepção envia ao aluno (ver src/lib/convite.ts).
export default function AcessoPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-areia-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-areia-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <Logo />
        </div>
        <CriarSenha />
      </div>
    </main>
  );
}
