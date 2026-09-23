// Análises da carteira: funções puras sobre o estado, prontas para os gráficos.
// Tudo em cima da leitura mensal da Credinfar (varredura) cruzada com a
// posição de cada cliente conosco.
import type { Cliente, EstadoHub, LeituraCliente, PontoHistorico, Sinal } from "../models/types";

export const NOTAS = ["A", "B", "C", "D", "E"] as const;
export type Nota = (typeof NOTAS)[number];

export interface Kpis {
  exposicao: number;
  vencido: number;
  pctVencido: number;
  clientesAtivos: number;
  emNotasDE: number;
  pctNotasDE: number;
  dso: number;
  decisoesAbertas: number;
  valorDecisoes: number;
  variacaoVencido: number; // pontos percentuais x mês anterior
}

export function kpis(e: EstadoHub): Kpis {
  const ativos = e.clientes.filter((c) => c.debitoAtual > 0);
  const exposicao = ativos.reduce((t, c) => t + c.debitoAtual, 0);
  const vencido = ativos.reduce((t, c) => t + c.debitoVencido, 0);
  const compras = ativos.reduce((t, c) => t + c.compraMes.valor, 0);
  const porNota = e.varredura?.porNota ?? {};
  const emNotasDE = (porNota.D?.debito ?? 0) + (porNota.E?.debito ?? 0);
  const abertas = e.sinais.filter((s) => s.status === "ABERTO");
  const h = e.historicoCarteira;
  const pctVencido = exposicao > 0 ? (vencido / exposicao) * 100 : 0;
  const anterior = h.length >= 2 ? h[h.length - 2].pctVencido : pctVencido;
  return {
    exposicao,
    vencido,
    pctVencido,
    clientesAtivos: ativos.length,
    emNotasDE,
    pctNotasDE: exposicao > 0 ? (emNotasDE / exposicao) * 100 : 0,
    dso: compras > 0 ? Math.round((exposicao / compras) * 30) : 0,
    decisoesAbertas: abertas.length,
    valorDecisoes: abertas.reduce((t, s) => t + s.valorEmJogo, 0),
    variacaoVencido: pctVencido - anterior,
  };
}

export interface FaixaAging {
  faixa: string;
  valor: number;
  antiga: boolean; // acima de 90 dias
}
export function aging(clientes: Cliente[]): FaixaAging[] {
  const soma = (k: keyof Cliente["vencidos"]) => clientes.reduce((t, c) => t + c.vencidos[k], 0);
  return [
    { faixa: "1 a 10", valor: soma("d01"), antiga: false },
    { faixa: "11 a 30", valor: soma("d11"), antiga: false },
    { faixa: "31 a 90", valor: soma("d31"), antiga: false },
    { faixa: "91 a 180", valor: soma("d91"), antiga: true },
    { faixa: "181 a 360", valor: soma("d181"), antiga: true },
    { faixa: "+360", valor: soma("d361"), antiga: true },
  ];
}

export interface LinhaNota {
  nota: Nota;
  clientes: number;
  debito: number;
  pct: number;
  vencido: number;
}
export function porNota(e: EstadoHub): LinhaNota[] {
  const total = Object.values(e.varredura?.porNota ?? {}).reduce((t, x) => t + x.debito, 0) || 1;
  const leituras = e.varredura?.leituras ?? [];
  return NOTAS.map((nota) => {
    const x = e.varredura?.porNota[nota] ?? { clientes: 0, debito: 0 };
    return { nota, clientes: x.clientes, debito: x.debito, pct: (x.debito / total) * 100, vencido: leituras.filter((l) => l.nota === nota).reduce((t, l) => t + l.vencido, 0) };
  });
}

export interface ItemConcentracao {
  nome: string;
  debito: number;
  pct: number;
  pctAcumulado: number;
}
export function concentracao(clientes: Cliente[], n = 10): { itens: ItemConcentracao[]; pctTop: number; clientesPara80: number } {
  const total = clientes.reduce((t, c) => t + c.debitoAtual, 0) || 1;
  const ordenados = [...clientes].sort((a, b) => b.debitoAtual - a.debitoAtual);
  let acumulado = 0;
  let clientesPara80 = 0;
  for (const c of ordenados) {
    acumulado += c.debitoAtual;
    clientesPara80 += 1;
    if (acumulado / total >= 0.8) break;
  }
  let acc = 0;
  const itens = ordenados.slice(0, n).map((c) => {
    acc += c.debitoAtual;
    return { nome: c.nome, debito: c.debitoAtual, pct: (c.debitoAtual / total) * 100, pctAcumulado: (acc / total) * 100 };
  });
  return { itens, pctTop: itens.length ? itens[itens.length - 1].pctAcumulado : 0, clientesPara80 };
}

export type Quadrante = "Atrasa com todo o mercado" | "Atrasa só com a gente" | "Em dia ou atraso leve";
export interface PontoQuadrante {
  nome: string;
  x: number; // % vencido no mercado
  y: number; // % vencido conosco
  z: number; // débito conosco
  grupo: Quadrante;
  nota: string;
}
export const CORTE_MERCADO = 20; // % vencido no mercado que já é atraso relevante
export const CORTE_NOSSO = 8; // % vencido conosco que já é atraso relevante
export function quadrantes(e: EstadoHub): { pontos: PontoQuadrante[]; resumo: { grupo: Quadrante; clientes: number; vencido: number }[] } {
  const porId = new Map(e.clientes.map((c) => [c.id, c]));
  const pontos: PontoQuadrante[] = [];
  for (const l of e.varredura?.leituras ?? []) {
    const c = porId.get(l.id);
    if (!c || c.debitoAtual < 20000) continue;
    const y = (c.debitoVencido / c.debitoAtual) * 100;
    const x = l.pctMercado;
    const grupo: Quadrante = y >= CORTE_NOSSO && x >= CORTE_MERCADO ? "Atrasa com todo o mercado" : y >= CORTE_NOSSO && x < 5 ? "Atrasa só com a gente" : "Em dia ou atraso leve";
    pontos.push({ nome: c.nome, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, z: c.debitoAtual, grupo, nota: l.nota });
  }
  const grupos: Quadrante[] = ["Atrasa com todo o mercado", "Atrasa só com a gente", "Em dia ou atraso leve"];
  const resumo = grupos.map((grupo) => {
    const do_ = pontos.filter((p) => p.grupo === grupo);
    return { grupo, clientes: do_.length, vencido: do_.reduce((t, p) => t + (p.y / 100) * p.z, 0) };
  });
  return { pontos, resumo };
}

export interface Migracao {
  matriz: number[][]; // [anterior][atual], índices em NOTAS
  pioraram: number;
  melhoraram: number;
  valorPiorou: number;
  valorMelhorou: number;
}
export function migracao(leituras: LeituraCliente[]): Migracao {
  const idx = (n: string) => Math.max(0, NOTAS.indexOf(n as Nota));
  const matriz = NOTAS.map(() => NOTAS.map(() => 0));
  let pioraram = 0;
  let melhoraram = 0;
  let valorPiorou = 0;
  let valorMelhorou = 0;
  for (const l of leituras) {
    const a = idx(l.notaAnterior);
    const b = idx(l.nota);
    matriz[a][b] += 1;
    if (b > a) {
      pioraram += 1;
      valorPiorou += l.debito;
    } else if (b < a) {
      melhoraram += 1;
      valorMelhorou += l.debito;
    }
  }
  return { matriz, pioraram, melhoraram, valorPiorou, valorMelhorou };
}

export interface LinhaUf {
  uf: string;
  debito: number;
  vencido: number;
  clientes: number;
}
export function porUf(clientes: Cliente[], n = 8): LinhaUf[] {
  const mapa = new Map<string, LinhaUf>();
  for (const c of clientes) {
    if (!c.uf) continue;
    const l = mapa.get(c.uf) ?? { uf: c.uf, debito: 0, vencido: 0, clientes: 0 };
    l.debito += c.debitoAtual;
    l.vencido += c.debitoVencido;
    l.clientes += 1;
    mapa.set(c.uf, l);
  }
  return [...mapa.values()].sort((a, b) => b.debito - a.debito).slice(0, n);
}

export interface EfeitoDecisoes {
  limiteReduzido: number; // soma das reduções de limite
  limiteAumentado: number;
  bloqueados: number; // débito dos clientes com vendas seguradas
  garantias: number;
  cobrancas: number;
  valorCobrado: number; // vencido dos clientes cobrados
  acompanhar: number;
}
export function efeitoDecisoes(e: EstadoHub): EfeitoDecisoes {
  const porId = new Map(e.clientes.map((c) => [c.id, c]));
  const r: EfeitoDecisoes = { limiteReduzido: 0, limiteAumentado: 0, bloqueados: 0, garantias: 0, cobrancas: 0, valorCobrado: 0, acompanhar: 0 };
  const decididos = e.sinais.filter((s): s is Sinal & { decisao: NonNullable<Sinal["decisao"]> } => s.status === "DECIDIDO" && !!s.decisao);
  for (const s of decididos) {
    const c = porId.get(s.clienteId);
    const d = s.decisao;
    if (d.acao === "AJUSTAR_LIMITE") {
      const m = /de R\$\s?([\d.]+) para R\$\s?([\d.]+)/.exec(d.detalhe);
      if (m) {
        const de = Number(m[1].replace(/\./g, ""));
        const para = Number(m[2].replace(/\./g, ""));
        if (para < de) r.limiteReduzido += de - para;
        else r.limiteAumentado += para - de;
      }
    } else if (d.acao === "BLOQUEAR_VENDAS") r.bloqueados += c?.debitoAtual ?? 0;
    else if (d.acao === "PEDIR_GARANTIA") r.garantias += c?.debitoAtual ?? 0;
    else if (d.acao === "REGISTRAR_CONTATO") {
      r.cobrancas += 1;
      r.valorCobrado += c?.debitoVencido ?? 0;
    } else r.acompanhar += 1;
  }
  return r;
}

export function tendencia(e: EstadoHub): PontoHistorico[] {
  return e.historicoCarteira;
}

export interface Analises {
  kpis: Kpis;
  aging: FaixaAging[];
  porNota: LinhaNota[];
  concentracao: ReturnType<typeof concentracao>;
  quadrantes: ReturnType<typeof quadrantes>;
  migracao: Migracao;
  porUf: LinhaUf[];
  efeito: EfeitoDecisoes;
  tendencia: PontoHistorico[];
}
export function analisar(e: EstadoHub): Analises {
  const ativos = e.clientes.filter((c) => c.debitoAtual > 0);
  return {
    kpis: kpis(e),
    aging: aging(ativos),
    porNota: porNota(e),
    concentracao: concentracao(ativos),
    quadrantes: quadrantes(e),
    migracao: migracao(e.varredura?.leituras ?? []),
    porUf: porUf(ativos),
    efeito: efeitoDecisoes(e),
    tendencia: tendencia(e),
  };
}
