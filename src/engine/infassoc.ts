// INFASSOC.SIC: arquivo texto de largura fixa (270 posições) enviado à
// Credinfar, conforme o LAYOUT CREDINFAR oficial (posições, tamanhos e tipos).
// Regras do layout: MMAAAA nas datas; valores inteiros sem centavos; da posição
// 001 (COD_ASSOCIADA) até a 020 (CONTR_CLIENTE) não pode haver espaço em branco;
// a partir da posição 121 (CLIENTE_DESDE) também não: falta de dado vira "0".
import type { Cliente } from "../models/types";
import { hashCurto, semAcento, soDigitos } from "./util";

export const LARGURA_LINHA = 270;

export interface CampoLayout {
  ordem: number;
  grupo: string;
  nome: string;
  descricao: string;
  inicio: number;
  fim: number;
  tamanho: number;
  tipo: "Numérico" | "Alfanumérico" | "Mês-Ano";
}

// Transcrição fiel do LAYOUT CREDINFAR (INFASSOC.SIC).
export const LAYOUT: CampoLayout[] = [
  { ordem: 1, grupo: "ASSOCIADA", nome: "COD_ASSOCIADA", descricao: "Código da associada", inicio: 1, fim: 3, tamanho: 3, tipo: "Numérico" },
  { ordem: 2, grupo: "ASSOCIADA", nome: "SEGMENTO", descricao: "00 Farmacêutico · 01 Veterinário · 02 Cosmético/Consumo", inicio: 4, fim: 5, tamanho: 2, tipo: "Numérico" },
  { ordem: 3, grupo: "CNPJ/CPF_CLIENTE", nome: "TIPO_CLIENTE", descricao: "CNPJ: caracter G · CPF: primeiro número do CPF", inicio: 6, fim: 6, tamanho: 1, tipo: "Alfanumérico" },
  { ordem: 4, grupo: "CNPJ/CPF_CLIENTE", nome: "NUMERO_CLIENTE", descricao: "CNPJ: número (raiz) · CPF: números restantes", inicio: 7, fim: 14, tamanho: 8, tipo: "Numérico" },
  { ordem: 5, grupo: "CNPJ/CPF_CLIENTE", nome: "COMPL_CLIENTE", descricao: "CNPJ: complemento · CPF: 0000", inicio: 15, fim: 18, tamanho: 4, tipo: "Numérico" },
  { ordem: 6, grupo: "CNPJ/CPF_CLIENTE", nome: "CONTR_CLIENTE", descricao: "Dígito de controle do CNPJ/CPF", inicio: 19, fim: 20, tamanho: 2, tipo: "Numérico" },
  { ordem: 7, grupo: "CADASTRO", nome: "RAZAO_SOCIAL", descricao: "Razão social do cliente", inicio: 21, fim: 60, tamanho: 40, tipo: "Alfanumérico" },
  { ordem: 8, grupo: "CADASTRO", nome: "ENDERECO", descricao: "Endereço do cliente", inicio: 61, fim: 90, tamanho: 30, tipo: "Alfanumérico" },
  { ordem: 9, grupo: "CADASTRO", nome: "CIDADE", descricao: "Cidade do cliente", inicio: 91, fim: 110, tamanho: 20, tipo: "Alfanumérico" },
  { ordem: 10, grupo: "CADASTRO", nome: "CEP", descricao: "CEP do cliente", inicio: 111, fim: 118, tamanho: 8, tipo: "Numérico" },
  { ordem: 11, grupo: "CADASTRO", nome: "UF", descricao: "UF do cliente", inicio: 119, fim: 120, tamanho: 2, tipo: "Alfanumérico" },
  { ordem: 12, grupo: "CADASTRO", nome: "CLIENTE_DESDE", descricao: "Data de cadastro do cliente", inicio: 121, fim: 126, tamanho: 6, tipo: "Mês-Ano" },
  { ordem: 13, grupo: "ULTIMA_COMPRA", nome: "DATA_UC", descricao: "Data da última compra", inicio: 127, fim: 132, tamanho: 6, tipo: "Mês-Ano" },
  { ordem: 14, grupo: "ULTIMA_COMPRA", nome: "VALOR_UC", descricao: "Valor da última compra", inicio: 133, fim: 141, tamanho: 9, tipo: "Numérico" },
  { ordem: 15, grupo: "MAIOR_NOTA_FISCAL", nome: "DATA_NF", descricao: "Data da maior nota fiscal", inicio: 142, fim: 147, tamanho: 6, tipo: "Mês-Ano" },
  { ordem: 16, grupo: "MAIOR_NOTA_FISCAL", nome: "VALOR_NF", descricao: "Valor da maior nota fiscal", inicio: 148, fim: 156, tamanho: 9, tipo: "Numérico" },
  { ordem: 17, grupo: "MAIOR_ACUMULO", nome: "DATA_MA", descricao: "Data do maior acúmulo", inicio: 157, fim: 162, tamanho: 6, tipo: "Mês-Ano" },
  { ordem: 18, grupo: "MAIOR_ACUMULO", nome: "VALOR_MA", descricao: "Valor do maior acúmulo", inicio: 163, fim: 171, tamanho: 9, tipo: "Numérico" },
  { ordem: 19, grupo: "LIMITE", nome: "LIMITE_CREDITO", descricao: "Valor do limite de crédito", inicio: 172, fim: 180, tamanho: 9, tipo: "Numérico" },
  { ordem: 20, grupo: "LIMITE", nome: "DIAS_ATRASO", descricao: "Dias médios de atraso", inicio: 181, fim: 183, tamanho: 3, tipo: "Numérico" },
  { ordem: 21, grupo: "DEBITOS", nome: "DEBITO_ATUAL", descricao: "Valor do débito atual", inicio: 184, fim: 192, tamanho: 9, tipo: "Numérico" },
  { ordem: 22, grupo: "DEBITOS", nome: "DEBITO_VENCIDOS", descricao: "Valor do débito já vencido", inicio: 193, fim: 201, tamanho: 9, tipo: "Numérico" },
  { ordem: 23, grupo: "COMPRA_MES", nome: "DATA_CM", descricao: "Data de compra do mês", inicio: 202, fim: 207, tamanho: 6, tipo: "Mês-Ano" },
  { ordem: 24, grupo: "COMPRA_MES", nome: "VALOR_CM", descricao: "Valor de compra do mês", inicio: 208, fim: 216, tamanho: 9, tipo: "Numérico" },
  { ordem: 25, grupo: "VENCIDOS", nome: "VENCIDOS_01_10_DIAS", descricao: "Vencidos do 1º ao 10º dia", inicio: 217, fim: 225, tamanho: 9, tipo: "Numérico" },
  { ordem: 26, grupo: "VENCIDOS", nome: "VENCIDOS_11_30_DIAS", descricao: "Vencidos do 11º ao 30º dia", inicio: 226, fim: 234, tamanho: 9, tipo: "Numérico" },
  { ordem: 27, grupo: "VENCIDOS", nome: "VENCIDOS_31_90_DIAS", descricao: "Vencidos do 31º ao 90º dia", inicio: 235, fim: 243, tamanho: 9, tipo: "Numérico" },
  { ordem: 28, grupo: "VENCIDOS", nome: "VENCIDOS_91_180_DIAS", descricao: "Vencidos do 91º ao 180º dia", inicio: 244, fim: 252, tamanho: 9, tipo: "Numérico" },
  { ordem: 29, grupo: "VENCIDOS", nome: "VENCIDOS_181_360_DIAS", descricao: "Vencidos do 181º ao 360º dia", inicio: 253, fim: 261, tamanho: 9, tipo: "Numérico" },
  { ordem: 30, grupo: "VENCIDOS", nome: "VENCIDOS_MAIS_360_DIAS", descricao: "Vencidos a partir do 361º dia", inicio: 262, fim: 270, tamanho: 9, tipo: "Numérico" },
];

export const VALOR_MAXIMO = 999_999_999; // 9 posições, inteiro

// Alfanumérico: alinha à esquerda, completa com espaços à direita, corta no tamanho.
export function padR(texto: string, tamanho: number): string {
  const t = semAcento(texto).toUpperCase().replace(/\s+/g, " ").trim();
  return (t + " ".repeat(tamanho)).slice(0, tamanho);
}
// Numérico: só dígitos, completa com zeros à esquerda; estoura = erro (não corta).
export function padN(valor: number | string, tamanho: number): string {
  const d = typeof valor === "number" ? String(Math.max(0, Math.round(valor))) : soDigitos(valor);
  if (d.length > tamanho) throw new Error(`valor ${d} excede ${tamanho} posições`);
  return d.padStart(tamanho, "0");
}
// Mês-Ano MMAAAA; vazio vira zeros (regra: sem espaço em branco a partir da 121).
export function padData(mmaaaa: string): string {
  const d = soDigitos(mmaaaa);
  return d.length === 6 ? d : "000000";
}

export interface ProblemaLinha {
  clienteId: string;
  campo: string;
  motivo: string;
}

// Monta a linha de 270 posições de um cliente, no layout oficial.
export function montarLinha(c: Cliente, codAssociada: string): string {
  const cnpj = soDigitos(c.cnpj);
  if (cnpj.length !== 14) throw new Error("CNPJ deve ter 14 dígitos");
  const partes = [
    padN(codAssociada, 3),
    padN(c.segmento, 2),
    "G", // TIPO_CLIENTE: pessoa jurídica
    cnpj.slice(0, 8),
    cnpj.slice(8, 12),
    cnpj.slice(12, 14),
    padR(c.nome, 40),
    padR(c.endereco, 30),
    padR(c.cidade, 20),
    padN(soDigitos(c.cep).padStart(8, "0").slice(-8), 8),
    padR(c.uf, 2),
    padData(c.clienteDesde),
    padData(c.ultimaCompra.data),
    padN(c.ultimaCompra.valor, 9),
    padData(c.maiorNota.data),
    padN(c.maiorNota.valor, 9),
    padData(c.maiorAcumulo.data),
    padN(c.maiorAcumulo.valor, 9),
    padN(c.limite, 9),
    padN(Math.min(999, c.diasAtraso), 3),
    padN(c.debitoAtual, 9),
    padN(c.debitoVencido, 9),
    padData(c.compraMes.data),
    padN(c.compraMes.valor, 9),
    padN(c.vencidos.d01, 9),
    padN(c.vencidos.d11, 9),
    padN(c.vencidos.d31, 9),
    padN(c.vencidos.d91, 9),
    padN(c.vencidos.d181, 9),
    padN(c.vencidos.d361, 9),
  ];
  const linha = partes.join("");
  if (linha.length !== LARGURA_LINHA) throw new Error(`linha com ${linha.length} posições (esperado ${LARGURA_LINHA})`);
  return linha;
}

// Valida uma linha pronta contra as regras do layout.
export function validarLinha(linha: string): string[] {
  const erros: string[] = [];
  if (linha.length !== LARGURA_LINHA) erros.push(`largura ${linha.length}, esperado ${LARGURA_LINHA}`);
  if (/\s/.test(linha.slice(0, 20))) erros.push("espaço em branco entre as posições 001 e 020");
  if (/\s/.test(linha.slice(120))) erros.push("espaço em branco a partir da posição 121 (preencher com 0)");
  if (!/^\d{5}G\d{14}$/.test(linha.slice(0, 20))) erros.push("identificação (posições 001 a 020) fora do padrão");
  return erros;
}

export interface ResultadoGeracao {
  conteudo: string; // linhas separadas por CRLF
  registros: number;
  largura: number;
  bytes: number;
  hash: string;
  problemas: ProblemaLinha[];
}

// Gera o arquivo inteiro. Cliente com problema NÃO entra e é reportado
// (a remessa só chega aqui depois da aprovação; problemas aqui são defesa em profundidade).
export function gerarInfassoc(clientes: Cliente[], codAssociada: string): ResultadoGeracao {
  const linhas: string[] = [];
  const problemas: ProblemaLinha[] = [];
  for (const c of clientes) {
    try {
      const l = montarLinha(c, codAssociada);
      const erros = validarLinha(l);
      if (erros.length > 0) {
        problemas.push({ clienteId: c.id, campo: "linha", motivo: erros.join("; ") });
        continue;
      }
      linhas.push(l);
    } catch (erro) {
      problemas.push({ clienteId: c.id, campo: "montagem", motivo: erro instanceof Error ? erro.message : String(erro) });
    }
  }
  const conteudo = linhas.join("\r\n") + (linhas.length > 0 ? "\r\n" : "");
  return {
    conteudo,
    registros: linhas.length,
    largura: LARGURA_LINHA,
    bytes: conteudo.length,
    hash: hashCurto(conteudo),
    problemas,
  };
}

// Decompõe uma linha nos campos do layout (visualização com régua de posições).
export function decomporLinha(linha: string): { campo: CampoLayout; valor: string }[] {
  return LAYOUT.map((campo) => ({ campo, valor: linha.slice(campo.inicio - 1, campo.fim) }));
}
