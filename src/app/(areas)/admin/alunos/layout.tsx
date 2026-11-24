import { AbasAlunos } from "./abas";

export const instant = false;

export default function Layout({ children }: LayoutProps<"/admin/alunos">) {
  return (
    <>
      <AbasAlunos />
      {children}
    </>
  );
}
