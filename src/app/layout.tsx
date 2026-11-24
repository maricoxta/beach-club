import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { marca } from "@/lib/marca";
import "./globals.css";

const titulo = Outfit({ variable: "--font-titulo", subsets: ["latin"] });
const corpo = Plus_Jakarta_Sans({ variable: "--font-corpo", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: marca.nome, template: `%s · ${marca.nome}` },
  description: marca.slogan,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${corpo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
