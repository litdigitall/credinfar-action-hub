// Motor de validação da remessa (rule engine, Documento Mestre §10 e §11.2).
// Cada regra é determinística e explica o motivo em linguagem do analista.
// BLOCKER impede a aprovação da remessa; DECISION/WARNING/INFO pedem decisão
// mas não bloqueiam.
import type { Acao, Cliente, CodigoAcao, DecisaoAcao, Severidade, TipoAcao } from "../models/types";
import { VALOR_MAXIMO } from "./infassoc";
import { brlInt, cnpjValido, soDigitos } from "./util";

export interface RegraDef {
  codigo: CodigoAcao;
  tipo: TipoAcao;
  severidade: Severidade;
  titulo: string;
  explicacao: string; // o que a regra verifica (tela Regras)
  acoes: DecisaoAcao[];
}

export const REGRAS: RegraDef[] = [
  {
    codigo: "CNPJ_INVALIDO",
    tipo: "BLOCKER",
    severidade: "Crítica",
    titulo: "CNPJ incompatível com o cadastro",
    explicacao: "Os dígitos de controle do CNPJ não conferem (módulo 11). O layout exige CNPJ válido nas posições 007 a 020.",
    acoes: ["CORRIGIR_DOCUMENTO", "EXCLUIR_DA_REMESSA", "SOLICITAR_REVISAO"],
  },
  {
    codigo: "AGING_MISMATCH",
    tipo: "BLOCKER",
    severidade: "Crítica",
    titulo: "Aging inconsistente",
    explicacao: "A soma das faixas de vencidos (1 a 10, 11 a 30, 31 a 90, 91 a 180, 181 a 360, mais de 360 dias) difere do débito vencido informado.",
    acoes: ["CORRIGIR_VALORES", "ACEITAR_ORIGEM", "EXCLUIR_DA_REMESSA"],
  },
  {
    codigo: "CADASTRO_INCOMPLETO",
    tipo: "BLOCKER",
    severidade: "Crítica",
    titulo: "Cadastro incompleto",
    explicacao: "Razão social, endereço, cidade, CEP (8 dígitos) ou UF em branco. O layout não aceita branco na identificação nem a partir da posição 121.",
    acoes: ["CORRIGIR_DOCUMENTO", "EXCLUIR_DA_REMESSA"],
  },
  {
    codigo: "VALOR_FORA_DO_LAYOUT",
    tipo: "BLOCKER",
    severidade: "Crítica",
    titulo: "Valor fora do layout",
    explicacao: "Algum valor é negativo ou excede 9 posições (999.999.999). O arquivo é inteiro, sem centavos.",
    acoes: ["CORRIGIR_VALORES", "EXCLUIR_DA_REMESSA"],
  },
  {
    codigo: "EXPOSICAO_ACIMA_LIMITE",
    tipo: "DECISION",
    severidade: "Crítica",
    titulo: "Exposição acima do limite",
    explicacao: "O débito atual do cliente supera o limite de crédito cadastrado.",
    acoes: ["MANTER_DADOS", "ALTERAR_LIMITE", "SOLICITAR_REVISAO"],
  },
  {
    codigo: "VENCIDOS_ACIMA_90",
    tipo: "DECISION",
    severidade: "Importante",
    titulo: "Vencidos acima de 90 dias",
    explicacao: "Há valores vencidos há mais de 90 dias (faixas 91 a 180, 181 a 360 e mais de 360). Informar à Credinfar afeta o risco do cliente na rede.",
    acoes: ["MANTER_DADOS", "RETIRAR_DA_REMESSA", "SOLICITAR_REVISAO"],
  },
  {
    codigo: "LIMITE_PROXIMO",
    tipo: "WARNING",
    severidade: "Importante",
    titulo: "Limite próximo do consumo total",
    explicacao: "O débito atual já consome 90% ou mais do limite de crédito.",
    acoes: ["MANTER_DADOS", "ALTERAR_LIMITE"],
  },
  {
    codigo: "SEM_MOVIMENTACAO",
    tipo: "INFO",
    severidade: "Informativa",
    titulo: "Cliente sem movimentação recente",
    explicacao: "Sem compra nos últimos 6 meses e sem débito. Pode sair da remessa para não consumir a base (a quota da API é 1,5x os registros enviados).",
    acoes: ["MANTER_NA_REMESSA", "RETIRAR_DA_REMESSA"],
  },
];
export const regraDe = (codigo: CodigoAcao): RegraDef => REGRAS.find((r) => r.codigo === codigo)!;

export const somaVencidos = (c: Cliente) =>
  c.vencidos.d01 + c.vencidos.d11 + c.vencidos.d31 + c.vencidos.d91 + c.vencidos.d181 + c.vencidos.d361;
export const vencidosAcima90 = (c: Cliente) => c.vencidos.d91 + c.vencidos.d181 + c.vencidos.d361;

// Meses entre um MMAAAA e a competência (MM/AAAA)
function mesesDesde(mmaaaa: string, competencia: string): number {
  const d = soDigitos(mmaaaa);
  if (d.length !== 6) return 999;
  const [mc, ac] = competencia.split("/").map(Number);
  return (ac - Number(d.slice(2))) * 12 + (mc - Number(d.slice(0, 2)));
}

interface Achado {
  codigo: CodigoAcao;
  mensagem: string;
  detalhe: string;
}

// Avalia UM cliente e devolve os achados (sem persistência).
export function avaliarCliente(c: Cliente, competencia: string): Achado[] {
  const achados: Achado[] = [];
  if (!cnpjValido(c.cnpj)) {
    achados.push({
      codigo: "CNPJ_INVALIDO",
      mensagem: "CNPJ incompatível com o cadastro",
      detalhe: `Dígitos de controle inválidos para ${c.cnpj}. Confira o CNPJ no cadastro do ERP.`,
    });
  }
  const soma = somaVencidos(c);
  if (soma !== c.debitoVencido) {
    achados.push({
      codigo: "AGING_MISMATCH",
      mensagem: "Soma das faixas difere do débito vencido",
      detalhe: `Faixas somam ${brlInt(soma)} e o débito vencido informado é ${brlInt(c.debitoVencido)} (diferença ${brlInt(c.debitoVencido - soma)}).`,
    });
  }
  const faltando: string[] = [];
  if (!c.nome.trim()) faltando.push("razão social");
  if (!c.endereco.trim()) faltando.push("endereço");
  if (!c.cidade.trim()) faltando.push("cidade");
  if (soDigitos(c.cep).length !== 8) faltando.push("CEP");
  if (!/^[A-Z]{2}$/.test(c.uf)) faltando.push("UF");
  if (soDigitos(c.clienteDesde).length !== 6) faltando.push("cliente desde");
  if (faltando.length > 0) {
    achados.push({ codigo: "CADASTRO_INCOMPLETO", mensagem: "Cadastro incompleto", detalhe: `Campos em branco: ${faltando.join(", ")}.` });
  }
  const valores = [
    c.limite, c.debitoAtual, c.debitoVencido, c.ultimaCompra.valor, c.maiorNota.valor, c.maiorAcumulo.valor, c.compraMes.valor,
    c.vencidos.d01, c.vencidos.d11, c.vencidos.d31, c.vencidos.d91, c.vencidos.d181, c.vencidos.d361,
  ];
  if (valores.some((v) => v < 0 || v > VALOR_MAXIMO || !Number.isFinite(v))) {
    achados.push({ codigo: "VALOR_FORA_DO_LAYOUT", mensagem: "Valor negativo ou acima de 9 posições", detalhe: "Todos os valores devem ser inteiros entre 0 e 999.999.999." });
  }
  if (c.limite > 0 && c.debitoAtual > c.limite) {
    achados.push({
      codigo: "EXPOSICAO_ACIMA_LIMITE",
      mensagem: "Exposição acima do limite",
      detalhe: `Débito atual ${brlInt(c.debitoAtual)} contra limite ${brlInt(c.limite)} (${Math.round((c.debitoAtual / c.limite) * 100)}%).`,
    });
  } else if (c.limite > 0 && c.debitoAtual >= c.limite * 0.9) {
    achados.push({
      codigo: "LIMITE_PROXIMO",
      mensagem: "Limite próximo do consumo total",
      detalhe: `Débito atual ${brlInt(c.debitoAtual)} consome ${Math.round((c.debitoAtual / c.limite) * 100)}% do limite ${brlInt(c.limite)}.`,
    });
  }
  const acima90 = vencidosAcima90(c);
  if (acima90 > 0) {
    achados.push({
      codigo: "VENCIDOS_ACIMA_90",
      mensagem: "Vencidos acima de 90 dias",
      detalhe: `${brlInt(acima90)} vencidos há mais de 90 dias (${Math.round((acima90 / Math.max(1, c.debitoVencido)) * 100)}% do vencido).`,
    });
  }
  if (c.debitoAtual === 0 && mesesDesde(c.ultimaCompra.data, competencia) >= 6) {
    achados.push({
      codigo: "SEM_MOVIMENTACAO",
      mensagem: "Cliente sem movimentação recente",
      detalhe: `Última compra em ${c.ultimaCompra.data.slice(0, 2)}/${c.ultimaCompra.data.slice(2)} e sem débito em aberto.`,
    });
  }
  return achados;
}

let seqAcao = 1000;
export function proximoIdAcao(): string {
  seqAcao += 1;
  return `ACT-${seqAcao}`;
}
export function ajustarSequenciaAcao(ids: string[]) {
  const maior = ids.reduce((m, id) => Math.max(m, Number(id.replace("ACT-", "")) || 0), 1000);
  seqAcao = Math.max(seqAcao, maior);
}

// Valida a remessa inteira: devolve as ações PENDING a criar.
export function validarRemessa(clientes: Cliente[], remessaId: string, competencia: string, agora: string): Acao[] {
  const acoes: Acao[] = [];
  for (const c of clientes) {
    for (const a of avaliarCliente(c, competencia)) {
      const regra = regraDe(a.codigo);
      acoes.push({
        id: proximoIdAcao(),
        remessaId,
        clienteId: c.id,
        tipo: regra.tipo,
        severidade: regra.severidade,
        codigo: a.codigo,
        mensagem: a.mensagem,
        detalhe: a.detalhe,
        acoesDisponiveis: regra.acoes,
        status: "PENDING",
        criadaEm: agora,
      });
    }
  }
  return acoes;
}

// Prontidão da remessa: % de registros sem bloqueio pendente.
export function resumoValidacao(clienteIds: string[], excluidos: string[], acoes: Acao[]) {
  const ativos = clienteIds.filter((id) => !excluidos.includes(id));
  const pendentes = acoes.filter((a) => a.status === "PENDING" && !excluidos.includes(a.clienteId));
  const bloqueadosSet = new Set(pendentes.filter((a) => a.tipo === "BLOCKER").map((a) => a.clienteId));
  const alertaSet = new Set(pendentes.filter((a) => a.tipo !== "BLOCKER").map((a) => a.clienteId));
  for (const id of bloqueadosSet) alertaSet.delete(id);
  const bloqueados = bloqueadosSet.size;
  const comAlerta = alertaSet.size;
  const aprovadosAuto = Math.max(0, ativos.length - bloqueados - comAlerta);
  const prontidao = ativos.length === 0 ? 100 : ((ativos.length - bloqueados) / ativos.length) * 100;
  return { ativos: ativos.length, bloqueados, comAlerta, aprovadosAuto, prontidao: Math.round(prontidao * 10) / 10 };
}
