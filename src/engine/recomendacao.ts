// Recomendação de crédito em linguagem simples, a partir da ficha da
// Credinfar e da posição do cliente conosco. Regras fixas, sem IA.
import type { Cliente } from "../models/types";
import type { FichaResumo } from "./credinfarMock";

export type Tom = "ok" | "aviso" | "erro";
export interface Recomendacao {
  titulo: string;
  tom: Tom;
  motivos: string[];
}

export const SIGNIFICADO_AVALIACAO: Record<string, string> = {
  A: "Excelente",
  B: "Boa",
  C: "Aceitável",
  D: "Fraca",
  E: "Insuficiente",
};

export function recomendar(f: FichaResumo, c: Cliente | null): Recomendacao {
  const oc = f.ocorrencias;
  const motivos: string[] = [];
  if (oc.falencias > 0) motivos.push("Há falência ou recuperação judicial registrada.");
  if (oc.protestos > 0) motivos.push(`${oc.protestos} protesto(s) em cartório.`);
  if (oc.inadimplencias > 0) motivos.push(`${oc.inadimplencias} registro(s) de inadimplência.`);
  if (f.percentualVencido > 20) motivos.push(`${Math.round(f.percentualVencido)}% do débito na rede está vencido.`);
  if (c && c.limite > 0 && c.debitoAtual > c.limite) motivos.push("O débito conosco já passou do limite de crédito.");
  if (c && c.vencidos.d91 + c.vencidos.d181 + c.vencidos.d361 > 0) motivos.push("Tem valores vencidos conosco há mais de 90 dias.");

  if (oc.falencias > 0 || f.avaliacao === "E") {
    return { titulo: "Restringir o crédito e cobrar", tom: "erro", motivos: motivos.length ? motivos : ["Avaliação E (insuficiente) na Credinfar."] };
  }
  if (f.avaliacao === "D" || oc.protestos > 0 || f.percentualVencido > 20 || (c !== null && c.limite > 0 && c.debitoAtual > c.limite)) {
    return { titulo: "Rever o limite antes de vender mais", tom: "aviso", motivos: motivos.length ? motivos : [`Avaliação ${f.avaliacao} na Credinfar.`] };
  }
  if ((f.avaliacao === "A" || f.avaliacao === "B") && f.percentualVencido < 5 && oc.cheques + oc.acoes + oc.inadimplencias === 0) {
    return { titulo: "Pode liberar: bom pagador na rede", tom: "ok", motivos: [`Avaliação ${f.avaliacao} (${SIGNIFICADO_AVALIACAO[f.avaliacao]}) com ${f.fontes.length} fornecedores informando.`, "Menos de 5% do débito na rede está vencido."] };
  }
  return { titulo: "Manter o limite e acompanhar", tom: "ok", motivos: motivos.length ? motivos : [`Avaliação ${f.avaliacao} (${SIGNIFICADO_AVALIACAO[f.avaliacao] ?? ""}) sem ocorrência grave.`] };
}
