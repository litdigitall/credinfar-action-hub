// Do dado à decisão. Cruza a posição do cliente conosco (ERP) com o que o
// mercado informa na Credinfar e devolve UMA leitura por cliente, em linguagem
// simples, com as ações possíveis. Regras fixas, sem IA.
//
// O que a integração permite (e a consulta manual, CNPJ a CNPJ, não):
//   • olhar a carteira inteira todo mês, dentro do limite de 1,5 consulta por
//     cliente enviado, e ser avisado de quem piorou ANTES de atrasar conosco;
//   • separar quem atrasa com todo mundo (risco de perda) de quem atrasa só
//     conosco (normalmente divergência de nota, boleto ou pedido);
//   • achar bons pagadores com o limite cheio (venda travada sem motivo).
import type { Cliente, OpcaoAcao, Parametros, Sinal, TipoSinal, CodigoSinal } from "../models/types";
import { consultarCredinfar, limiteQuota, type FichaResumo } from "./credinfarMock";
import { brlInt, raizCnpj } from "./util";

export const RESERVA_CONSULTAS = 300; // consultas guardadas para o dia a dia

export interface Leitura {
  codigo: CodigoSinal | "SEM_SINAL";
  tipo: TipoSinal | null;
  cor: "verde" | "amarelo" | "vermelho";
  titulo: string;
  porque: string[];
  valorEmJogo: number;
  opcoes: OpcaoAcao[];
}

export const SIGNIFICADO_NOTA: Record<string, string> = { A: "excelente", B: "boa", C: "aceitável", D: "fraca", E: "insuficiente" };

const mil = (v: number) => Math.max(1000, Math.round(v / 1000) * 1000);
const acompanhar = (rotulo = "Só acompanhar"): OpcaoAcao => ({ acao: "ACOMPANHAR", rotulo });

export function avaliar(c: Cliente | null, f: FichaResumo): Leitura {
  const oc = f.ocorrencias;
  const pct = f.percentualVencido;
  const nota = f.avaliacao;
  const piorouNota = f.avaliacaoAnterior < nota && nota >= "C"; // caiu para C ou pior (de A para B não preocupa)
  const relevante = (c?.debitoAtual ?? 0) >= 50000; // abaixo disso não vale a atenção do analista
  const exposicao = c?.debitoAtual ?? 0;
  const vencidoNosso = c?.debitoVencido ?? 0;
  const uso = c && c.limite > 0 ? c.debitoAtual / c.limite : 0;

  // 1) Risco alto de perda
  if (c && exposicao > 0 && (oc.falencias > 0 || nota === "E")) {
    const congelar = mil(c.debitoAtual);
    return {
      codigo: "RISCO_GRAVE",
      tipo: "RISCO",
      cor: "vermelho",
      titulo: "Risco alto de não receber",
      porque: [
        oc.falencias > 0 ? "Tem recuperação judicial ou falência registrada." : "Nota E na Credinfar, a pior da escala.",
        `Deve ${brlInt(exposicao)} para a gente${vencidoNosso > 0 ? `, ${brlInt(vencidoNosso)} já vencidos` : ""}.`,
        ...(pct > 20 ? [`${Math.round(pct)}% do que deve no mercado está vencido.`] : []),
      ],
      valorEmJogo: exposicao,
      opcoes: [
        { acao: "BLOQUEAR_VENDAS", rotulo: "Segurar novas vendas a prazo" },
        ...(congelar < c.limite ? [{ acao: "AJUSTAR_LIMITE" as const, rotulo: `Reduzir limite de ${brlInt(c.limite)} para ${brlInt(congelar)}`, novoLimite: congelar }] : []),
        { acao: "PEDIR_GARANTIA", rotulo: "Pedir garantia ou pagamento antecipado" },
        acompanhar(),
      ],
    };
  }

  // 2) Risco subindo: piorou no mercado antes de virar problema conosco
  if (c && relevante && (piorouNota || (f.naListaPerformance && f.tendencia === "piorando" && pct > 15) || (oc.protestos > 0 && pct > 25))) {
    let novo = mil(Math.max(c.debitoAtual, c.limite * 0.7));
    if (novo >= c.limite) novo = mil(c.limite * 0.85);
    return {
      codigo: "RISCO_SUBINDO",
      tipo: "RISCO",
      cor: nota >= "D" ? "vermelho" : "amarelo",
      titulo: "O risco deste cliente está subindo",
      porque: [
        ...(piorouNota ? [`A nota na Credinfar caiu de ${f.avaliacaoAnterior} para ${nota}.`] : []),
        ...(f.tendencia === "piorando" ? ["O vencido dele no mercado vem crescendo nos últimos meses."] : []),
        ...(f.naListaPerformance ? ["Entrou na lista de atenção da Credinfar (relatório semanal de Performance)."] : []),
        ...(oc.protestos > 0 ? [`${oc.protestos} protesto(s) em cartório.`] : []),
        vencidoNosso > 0 ? `Com a gente: ${brlInt(vencidoNosso)} vencidos.` : `Com a gente ainda está em dia: deve ${brlInt(exposicao)}.`,
      ].slice(0, 4),
      valorEmJogo: exposicao,
      opcoes: [
        { acao: "AJUSTAR_LIMITE", rotulo: `Reduzir limite de ${brlInt(c.limite)} para ${brlInt(novo)}`, novoLimite: novo },
        { acao: "PEDIR_GARANTIA", rotulo: "Pedir garantia ou pagamento antecipado" },
        acompanhar(),
      ],
    };
  }

  // 3) Cobrança: atrasa com todo mundo x atrasa só com a gente
  if (c && vencidoNosso >= 30000 && pct >= 25) {
    return {
      codigo: "ATRASA_COM_TODOS",
      tipo: "COBRANCA",
      cor: "vermelho",
      titulo: "Está atrasando com todo o mercado",
      porque: [`${Math.round(pct)}% do que deve no mercado está vencido (nota ${nota}).`, `Com a gente: ${brlInt(vencidoNosso)} vencidos, ${c.diasAtraso} dias de atraso médio.`, "Quem cobra primeiro recebe primeiro."],
      valorEmJogo: vencidoNosso,
      opcoes: [{ acao: "REGISTRAR_CONTATO", rotulo: "Cobrar agora e registrar" }, { acao: "BLOQUEAR_VENDAS", rotulo: "Segurar novas vendas a prazo" }, acompanhar()],
    };
  }
  if (c && vencidoNosso >= 20000 && vencidoNosso / Math.max(1, c.debitoAtual) >= 0.08 && pct < 5 && nota <= "B") {
    return {
      codigo: "ATRASA_SO_CONOSCO",
      tipo: "COBRANCA",
      cor: "amarelo",
      titulo: "Paga os outros em dia e atrasa com a gente",
      porque: [`No mercado só ${pct.toFixed(1)}% está vencido (nota ${nota}).`, `Com a gente: ${brlInt(vencidoNosso)} vencidos.`, "Costuma ser nota divergente, boleto que não chegou ou pedido em disputa. Vale uma ligação."],
      valorEmJogo: vencidoNosso,
      opcoes: [{ acao: "REGISTRAR_CONTATO", rotulo: "Ligar e registrar" }, acompanhar()],
    };
  }

  // 4) Oportunidade: bom pagador com o limite quase cheio
  const semOcorrencia = oc.protestos + oc.cheques + oc.acoes + oc.inadimplencias + oc.falencias === 0;
  if (c && c.limite >= 150000 && uso >= 0.82 && vencidoNosso === 0 && nota === "A" && pct < 3 && semOcorrencia && !c.bloqueado) {
    const novo = mil(c.limite * 1.25);
    return {
      codigo: "PODE_VENDER_MAIS",
      tipo: "OPORTUNIDADE",
      cor: "verde",
      titulo: "Bom pagador com o limite quase cheio",
      porque: [
        `Nota ${nota} na Credinfar e só ${pct.toFixed(1)}% vencido no mercado.`,
        `Usa ${Math.round(uso * 100)}% do limite e está em dia com a gente.`,
        ...(f.limiteMedioMercado > 0 ? [`Outros fornecedores dão em média ${brlInt(f.limiteMedioMercado)} de limite.`] : []),
      ],
      valorEmJogo: novo - c.limite,
      opcoes: [{ acao: "AJUSTAR_LIMITE", rotulo: `Aumentar limite de ${brlInt(c.limite)} para ${brlInt(novo)}`, novoLimite: novo }, acompanhar("Agora não")],
    };
  }

  // Sem urgência
  const atencao = nota >= "D" || pct > 10 || oc.protestos > 0;
  return {
    codigo: "SEM_SINAL",
    tipo: null,
    cor: atencao ? "amarelo" : "verde",
    titulo: atencao ? "Sem urgência, mas vale acompanhar" : "Tudo certo com este cliente",
    porque: [
      `Nota ${nota} (${SIGNIFICADO_NOTA[nota] ?? ""}) na Credinfar, ${pct.toFixed(1)}% vencido no mercado.`,
      ...(c ? [vencidoNosso > 0 ? `Com a gente: ${brlInt(vencidoNosso)} vencidos de ${brlInt(exposicao)}.` : exposicao > 0 ? `Com a gente está em dia: deve ${brlInt(exposicao)}.` : "Sem débito com a gente."] : ["Não é nosso cliente: a leitura considera só o mercado."]),
    ],
    valorEmJogo: 0,
    opcoes: c ? [{ acao: "AJUSTAR_LIMITE", rotulo: "Mudar o limite", novoLimite: c.limite }, acompanhar()] : [],
  };
}

export interface ResultadoVarredura {
  sinais: Sinal[];
  consultados: number;
  semQuota: number; // clientes que ficaram de fora por falta de consultas
  porNota: Record<string, { clientes: number; debito: number }>; // retrato da carteira por nota da Credinfar
  erro?: string;
}

// Atualização mensal da carteira: consulta os clientes de maior débito até o
// limite do mês (menos a reserva do dia a dia) e monta a lista de decisões.
export function lerCarteira(clientes: Cliente[], parametros: Parametros, consultasUsadas: number, agora = new Date()): ResultadoVarredura {
  const disponivel = Math.max(0, limiteQuota(parametros) - consultasUsadas - RESERVA_CONSULTAS);
  const candidatos = clientes.filter((c) => c.debitoAtual > 0 || c.limite > 0).sort((a, b) => b.debitoAtual - a.debitoAtual);
  const sinais: Sinal[] = [];
  const porNota: ResultadoVarredura["porNota"] = { A: { clientes: 0, debito: 0 }, B: { clientes: 0, debito: 0 }, C: { clientes: 0, debito: 0 }, D: { clientes: 0, debito: 0 }, E: { clientes: 0, debito: 0 } };
  const vistos = new Set<string>();
  let n = 0;
  let semQuota = 0;
  const em = agora.toISOString();
  for (const c of candidatos) {
    const raiz = raizCnpj(c.cnpj);
    if (vistos.has(raiz)) continue;
    vistos.add(raiz);
    if (n >= disponivel) {
      semQuota += 1;
      continue;
    }
    const resp = consultarCredinfar(raiz, parametros, [c], consultasUsadas + n, agora, { semXml: true });
    if (resp.resultado === "IP_NAO_AUTORIZADO" || resp.resultado === "TOKEN_INVALIDO") {
      return { sinais: [], consultados: 0, semQuota: 0, porNota, erro: resp.resultado === "IP_NAO_AUTORIZADO" ? "A Credinfar recusou: o IP de saída não é o cadastrado." : "A Credinfar recusou: chave de acesso ausente ou inválida." };
    }
    if (resp.resultado === "LIMITE_EXCEDIDO") {
      semQuota += 1;
      continue;
    }
    n += 1;
    if (!resp.ficha) continue;
    const grupo = porNota[resp.ficha.avaliacao];
    if (grupo) {
      grupo.clientes += 1;
      grupo.debito += c.debitoAtual;
    }
    const l = avaliar(c, resp.ficha);
    if (!l.tipo || l.codigo === "SEM_SINAL") continue;
    sinais.push({
      id: `SIN-${c.id}-${l.codigo}`,
      clienteId: c.id,
      tipo: l.tipo,
      codigo: l.codigo,
      cor: l.cor,
      titulo: l.titulo,
      porque: l.porque,
      valorEmJogo: l.valorEmJogo,
      opcoes: l.opcoes,
      nota: resp.ficha.avaliacao,
      criadoEm: em,
      status: "ABERTO",
    });
  }
  const peso: Record<TipoSinal, number> = { RISCO: 0, COBRANCA: 1, OPORTUNIDADE: 2 };
  sinais.sort((a, b) => peso[a.tipo] - peso[b.tipo] || b.valorEmJogo - a.valorEmJogo);
  return { sinais, consultados: n, semQuota, porNota };
}
