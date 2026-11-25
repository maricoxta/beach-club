"use client";

import { useEffect } from "react";
import { marcarAvisosLidos } from "../agenda/acoes";

// Marca os avisos como vistos depois que a página aparece (o selo "Novo" fica até a próxima visita).
export function MarcarLidos({ ativo }: { ativo: boolean }) {
  useEffect(() => {
    if (ativo) void marcarAvisosLidos();
  }, [ativo]);
  return null;
}
