// Leitura de um arquivo de carteira (CSV com ; ou ,) para simular a remessa
// vinda do ERP por arquivo. Cabeçalho esperado (qualquer ordem, sem acento):
// cnpj;razao_social;endereco;cidade;cep;uf;segmento;cliente_desde;limite;
// debito_atual;debito_vencido;venc_01_10;venc_11_30;venc_31_90;venc_91_180;
// venc_181_360;venc_360;ultima_compra;valor_ultima_compra;dias_atraso
import type { Cliente, Segmento } from "../models/types";
import { soDigitos } from "../engine/util";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, "_");

const numero = (s: string) => {
  const t = (s ?? "").trim().replace(/\s/g, "").replace(/^R\$/, "");
  if (!t) return 0;
  const v = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

export interface ResultadoArquivo {
  clientes: Cliente[];
  avisos: string[];
}

export function lerCarteiraCsv(texto: string): ResultadoArquivo {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const avisos: string[] = [];
  if (linhas.length < 2) return { clientes: [], avisos: ["Arquivo vazio ou sem linhas de dados."] };
  const sep = (linhas[0].match(/;/g) ?? []).length >= (linhas[0].match(/,/g) ?? []).length ? ";" : ",";
  const cab = linhas[0].split(sep).map(norm);
  const idx = (nome: string) => cab.indexOf(nome);
  if (idx("cnpj") < 0) return { clientes: [], avisos: ["Cabeçalho sem a coluna cnpj. Use o modelo de carteira do Action Hub."] };
  const g = (cols: string[], nome: string) => (idx(nome) >= 0 ? (cols[idx(nome)] ?? "").trim() : "");
  const clientes: Cliente[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(sep);
    const cnpj = soDigitos(g(cols, "cnpj"));
    if (cnpj.length !== 14) {
      avisos.push(`Linha ${i + 1}: CNPJ com ${cnpj.length} dígitos (esperado 14), linha ignorada.`);
      continue;
    }
    const seg = (["00", "01", "02"].includes(g(cols, "segmento")) ? g(cols, "segmento") : "00") as Segmento;
    const vencidos = { d01: numero(g(cols, "venc_01_10")), d11: numero(g(cols, "venc_11_30")), d31: numero(g(cols, "venc_31_90")), d91: numero(g(cols, "venc_91_180")), d181: numero(g(cols, "venc_181_360")), d361: numero(g(cols, "venc_360")) };
    const debitoVencido = idx("debito_vencido") >= 0 ? numero(g(cols, "debito_vencido")) : Object.values(vencidos).reduce((t, v) => t + v, 0);
    const debitoAtual = numero(g(cols, "debito_atual"));
    const limite = numero(g(cols, "limite"));
    const pct = debitoAtual > 0 ? debitoVencido / debitoAtual : 0;
    clientes.push({
      id: "",
      cnpj,
      nome: (g(cols, "razao_social") || g(cols, "nome")).toUpperCase(),
      endereco: g(cols, "endereco").toUpperCase(),
      cidade: g(cols, "cidade").toUpperCase(),
      cep: soDigitos(g(cols, "cep")),
      uf: g(cols, "uf").toUpperCase(),
      segmento: seg,
      clienteDesde: soDigitos(g(cols, "cliente_desde")),
      ultimaCompra: { data: soDigitos(g(cols, "ultima_compra")), valor: numero(g(cols, "valor_ultima_compra")) },
      maiorNota: { data: soDigitos(g(cols, "data_maior_nf")), valor: numero(g(cols, "valor_maior_nf")) },
      maiorAcumulo: { data: soDigitos(g(cols, "data_maior_acumulo")), valor: numero(g(cols, "valor_maior_acumulo")) },
      limite,
      diasAtraso: numero(g(cols, "dias_atraso")),
      debitoAtual,
      debitoVencido,
      compraMes: { data: soDigitos(g(cols, "data_compra_mes")), valor: numero(g(cols, "valor_compra_mes")) },
      vencidos,
      risco: pct > 0.25 || debitoAtual > limite ? "Alto" : pct > 0.08 ? "Médio" : "Baixo",
      canal: g(cols, "canal") || "Não informado",
      cnae: g(cols, "cnae"),
      naturezaJuridica: g(cols, "natureza_juridica"),
      grupoEconomico: g(cols, "grupo_economico"),
    });
  }
  return { clientes, avisos };
}

export const MODELO_CSV =
  "cnpj;razao_social;endereco;cidade;cep;uf;segmento;cliente_desde;limite;debito_atual;debito_vencido;venc_01_10;venc_11_30;venc_31_90;venc_91_180;venc_181_360;venc_360;ultima_compra;valor_ultima_compra;dias_atraso\r\n" +
  "45222111000107;FARMACIA BOA VIDA LTDA;AV PAULISTA, 1000;SAO PAULO;01310930;SP;00;012019;100000;74000;18400;9000;4600;4800;0;0;0;082026;8880;18\r\n";
