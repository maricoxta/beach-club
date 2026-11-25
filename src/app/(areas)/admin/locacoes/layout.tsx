import { AbasLocacoes } from "./abas";

export const instant = false;

export default function Layout({ children }: LayoutProps<"/admin/locacoes">) {
  return (
    <>
      <AbasLocacoes />
      {children}
    </>
  );
}
