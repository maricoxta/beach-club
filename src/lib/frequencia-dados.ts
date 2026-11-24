import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  BUCKET_FOTOS,
  RESUMO_VAZIO,
  gradeDoMes,
  type Atividade,
  type AtividadeComFoto,
  type Resumo,
} from "@/lib/frequencia";

const COLUNAS = "id, aluno_id, data, tipo, duracao_min, distancia_km, calorias, passos, foto_path, observacao, created_at";

// Resumo geral + atividades da grade do mês, com links temporários (1h) das fotos.
// O RLS garante que o aluno só lê o que é dele; staff lê de qualquer aluno.
export async function carregarFrequencia(alunoId: string, mes: string) {
  const supabase = await createClient();
  const grade = gradeDoMes(mes);
  const de = grade[0][0];
  const ate = grade[grade.length - 1][6];

  const [resumoRes, atividadesRes] = await Promise.all([
    supabase
      .from("vw_frequencia_resumo")
      .select("checkins, dias_ativos, duracao_min, distancia_km, calorias, passos")
      .eq("aluno_id", alunoId)
      .maybeSingle(),
    supabase
      .from("atividades")
      .select(COLUNAS)
      .eq("aluno_id", alunoId)
      .gte("data", de)
      .lte("data", ate)
      .order("data")
      .order("created_at"),
  ]);
  if (resumoRes.error) console.error("[frequencia] resumo:", resumoRes.error.code, resumoRes.error.message);
  if (atividadesRes.error) console.error("[frequencia] atividades:", atividadesRes.error.code, atividadesRes.error.message);

  const resumo: Resumo = resumoRes.data
    ? {
        checkins: Number(resumoRes.data.checkins),
        dias_ativos: Number(resumoRes.data.dias_ativos),
        duracao_min: Number(resumoRes.data.duracao_min),
        distancia_km: Number(resumoRes.data.distancia_km),
        calorias: Number(resumoRes.data.calorias),
        passos: Number(resumoRes.data.passos),
      }
    : RESUMO_VAZIO;

  const atividades = (atividadesRes.data ?? []) as Atividade[];
  const caminhos = atividades.map((a) => a.foto_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (caminhos.length) {
    const { data, error } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(caminhos, 60 * 60);
    if (error) console.error("[frequencia] fotos:", error.message);
    for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }

  const comFoto: AtividadeComFoto[] = atividades.map((a) => ({
    ...a,
    distancia_km: a.distancia_km === null ? null : Number(a.distancia_km),
    fotoUrl: a.foto_path ? (urls.get(a.foto_path) ?? null) : null,
  }));

  return { resumo, atividades: comFoto, grade };
}
