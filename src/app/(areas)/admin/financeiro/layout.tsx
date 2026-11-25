import { AbasFinanceiro } from "./abas";

export const instant = false;

export default function Layout({ children }: LayoutProps<"/admin/financeiro">) {
  return (
    <>
      <AbasFinanceiro />
      {children}
    </>
  );
}
