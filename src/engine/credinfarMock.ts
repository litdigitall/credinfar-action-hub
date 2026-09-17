// Simulação da API Web Credinfar (Manual Técnico V1.4, 07/2025) para o
// protótipo. Reproduz o contrato observável: endpoint GET por raiz de CNPJ,
// headers Login + Authorization Bearer, restrição por IP (erro em XML com o IP
// de origem), quota mensal de 1,5x, base em D-1, XML <dbCredinfar> com os 26
// blocos do manual, fontes anonimizadas (até 10 nas Informações Negociais) e
// balanços dos três últimos períodos (ou nenhum).
// Tudo é determinístico a partir da raiz do CNPJ: a mesma consulta devolve o
// mesmo XML, como uma VIEW congelada.
import type { Cliente, IndicadoresBalanco, Parametros, ResultadoConsulta } from "../models/types";
import { formatarCnpj, prng, raizCnpj, sementeDe, soDigitos } from "./util";

export const LIMITE_FONTES_NEGOCIAIS = 10;

export interface FonteNegocial {
  fonte: string; // "Fonte 01" (nunca o nome/código da associada)
  dataAtualizacao: string;
  clienteDesde: string;
  maiorSaldo: number;
  ultimaCompra: number;
  mediaAtraso: number;
  limite: number;
  debitoAtual: number;
  debitoVencido: number;
  vencidos: [number, number, number, number, number, number];
}

export interface FichaResumo {
  cnpjRaiz: string;
  nome: string;
  nomeFantasia: string;
  situacaoCadastral: string;
  cnae: string;
  naturezaJuridica: string;
  cidade: string;
  uf: string;
  grupoEconomico: string;
  canal: string;
  dataBase: string; // D-1
  avaliacao: string; // riskRating.avaliacaoAtual
  frases: string[];
  debitoAtualRede: number; // soma das fontes
  debitoVencidoRede: number;
  percentualVencido: number;
  fontes: FonteNegocial[];
  totalFontes: number;
  consultasMes: number;
  consultas30d: number;
  serieMeses: { mes: string; compra: number; debito: number; vencido: number; dso: number; consultas: number }[];
  ocorrencias: { protestos: number; cheques: number; acoes: number; falencias: number; inadimplencias: number; valorProtestos: number };
  simples: string;
  sintegra: string;
  socios: string[];
  balancos: IndicadoresBalanco[]; // 0 ou 3 períodos
}

export interface RespostaCredinfar {
  resultado: ResultadoConsulta;
  httpStatus: number;
  xml: string;
  ficha: FichaResumo | null;
  duracaoMs: number;
  bytes: number;
}

// Formatos do manual: "64.273" (inteiro com ponto de milhar) e "9,94" (decimal com vírgula)
const num = (v: number) => Math.round(v).toLocaleString("pt-BR");
const dec = (v: number, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tag = (nome: string, valor: string | number, atrib = "") => `<${nome}${atrib}>${esc(String(valor))}</${nome}>`;
const dataBr = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
const mesAno = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

export function limiteQuota(p: Parametros): number {
  return Math.floor(p.registrosMesAnterior * 1.5);
}

export function xmlErro(codigo: number, mensagem: string, extras: Record<string, string> = {}): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<dbCredinfar>\n  <erro>\n    ${tag("codigo", codigo)}\n    ${tag("mensagem", mensagem)}\n` +
    Object.entries(extras).map(([k, v]) => `    ${tag(k, v)}\n`).join("") +
    `  </erro>\n</dbCredinfar>`
  );
}

const FRASES_RISCO: Record<string, string[]> = {
  A: ["Cliente tradicional no segmento", "Expressiva diluição quanto ao número de fornecedores", "Paga em dia com regularidade", "Está em dia com a apresentação do balanço", "Performance: EXCELENTE"],
  B: ["Cliente tradicional no segmento", "Boa diluição quanto ao número de fornecedores", "Paga com pequenos atrasos", "Está em dia com a apresentação do balanço", "Performance: BOA"],
  C: ["Cliente tradicional no segmento", "Expressiva diluição quanto ao número de fornecedores", "Número de consultas um pouco acima da normalidade", "Está em dia com a apresentação do balanço", "Paga atrasado com expressividade RELEVANTE", "Performance: ACEITÁVEL"],
  D: ["Número de consultas acima da normalidade", "Paga atrasado com expressividade ELEVADA", "Balanço não apresentado no último período", "Performance: FRACA"],
  E: ["Ocorrências de protesto e inadimplência registradas", "Paga atrasado com expressividade CRÍTICA", "Balanço não apresentado", "Performance: INSUFICIENTE"],
};
const CONCEITOS = ["ÓTIMO", "BOM", "RAZOÁVEL", "FRACO", "DEFICIENTE"];
const NOMES_SOCIOS = ["MARCELO ADRIANO CASARIN", "ANDREA DE LIMA E SYLOS", "CARLA ROSANA SGROTT SAUER", "ALEXANDRE IGLESIAS DOS ANJOS", "RENATA MOURA BITTENCOURT", "JOAO PEDRO ALBUQUERQUE", "LUCIANA PRADO FERRAZ", "RICARDO TAVARES LEMOS"];

function avaliacaoDe(risco: Cliente["risco"] | null, r: () => number): string {
  if (risco === "Baixo") return r() < 0.7 ? "A" : "B";
  if (risco === "Médio") return r() < 0.6 ? "B" : "C";
  if (risco === "Alto") return r() < 0.6 ? "C" : "D";
  if (risco === "Crítico") return r() < 0.5 ? "D" : "E";
  return "ABCDE"[Math.floor(r() * 5)];
}

// Empresa desconhecida da carteira: a Credinfar tem dados de outras associadas.
function empresaSintetica(raiz: string, r: () => number): Cliente {
  const ufs = ["SP", "RJ", "MG", "PR", "SC", "RS", "BA", "GO"];
  const cidades = ["SAO PAULO", "RIO DE JANEIRO", "BELO HORIZONTE", "CURITIBA", "FLORIANOPOLIS", "PORTO ALEGRE", "SALVADOR", "GOIANIA"];
  const i = Math.floor(r() * ufs.length);
  const limite = Math.round((20000 + r() * 400000) / 1000) * 1000;
  const atual = Math.round(limite * (0.2 + r() * 0.9));
  const vencido = Math.round(atual * r() * 0.3);
  return {
    id: `EXT-${raiz}`,
    cnpj: raiz + "0001" + "00",
    nome: `EMPRESA ${raiz} LTDA`,
    endereco: `RUA ${Math.floor(r() * 900) + 100}, ${Math.floor(r() * 2000)}`,
    cidade: cidades[i],
    cep: String(Math.floor(r() * 90000000) + 1000000).padStart(8, "0"),
    uf: ufs[i],
    segmento: "00",
    clienteDesde: "012019",
    ultimaCompra: { data: "082026", valor: Math.round(atual * 0.1) },
    maiorNota: { data: "052026", valor: Math.round(atual * 0.3) },
    maiorAcumulo: { data: "062026", valor: Math.round(atual * 1.2) },
    limite,
    diasAtraso: Math.floor(r() * 20),
    debitoAtual: atual,
    debitoVencido: vencido,
    compraMes: { data: "082026", valor: Math.round(atual * 0.2) },
    vencidos: { d01: Math.round(vencido * 0.5), d11: Math.round(vencido * 0.3), d31: vencido - Math.round(vencido * 0.5) - Math.round(vencido * 0.3), d91: 0, d181: 0, d361: 0 },
    risco: vencido / Math.max(1, atual) > 0.2 ? "Alto" : "Médio",
    canal: "Rede de Farmácia",
    cnae: "4771701 - Comércio varejista de produtos farmacêuticos, sem manipulação de fórmulas",
    naturezaJuridica: "2062 - Sociedade Empresária Limitada",
    grupoEconomico: "",
  };
}

// Consulta consolidada (FIC + balanços) por raiz de CNPJ.
export function consultarCredinfar(
  cnpjRaizEntrada: string,
  parametros: Parametros,
  clientes: Cliente[],
  consultasNoCiclo: number,
  agora = new Date()
): RespostaCredinfar {
  const raiz = soDigitos(cnpjRaizEntrada).slice(0, 8);
  const r = prng(sementeDe("credinfar:" + raiz));
  const duracaoBase = 380 + Math.floor(r() * 900);

  if (!parametros.token || /INVALID/i.test(parametros.token)) {
    return { resultado: "TOKEN_INVALIDO", httpStatus: 401, xml: xmlErro(401, "Token de acesso inválido ou não informado. Solicite o token à Credinfar mediante termo de responsabilidade."), ficha: null, duracaoMs: 120, bytes: 0 };
  }
  if (parametros.ipSaida.trim() !== parametros.ipCadastrado.trim()) {
    const xml = xmlErro(403, "IP não autorizado. Somente IPs previamente cadastrados junto à Credinfar podem consumir a API.", { ipOrigem: parametros.ipSaida, ipCadastrado: parametros.ipCadastrado });
    return { resultado: "IP_NAO_AUTORIZADO", httpStatus: 403, xml, ficha: null, duracaoMs: 95, bytes: xml.length };
  }
  const limite = limiteQuota(parametros);
  if (consultasNoCiclo >= limite) {
    const xml = xmlErro(429, "Limite mensal de consultas excedido. O acesso fica suspenso até o início do próximo ciclo.", { limiteMensal: String(limite), consultasRealizadas: String(consultasNoCiclo) });
    return { resultado: "LIMITE_EXCEDIDO", httpStatus: 429, xml, ficha: null, duracaoMs: 80, bytes: xml.length };
  }
  if (raiz.length !== 8) {
    const xml = xmlErro(400, "Parâmetro nrCnpj inválido: informe a raiz do CNPJ com 8 dígitos.");
    return { resultado: "SEM_DADOS", httpStatus: 400, xml, ficha: null, duracaoMs: 60, bytes: xml.length };
  }

  const filiais = clientes.filter((c) => raizCnpj(c.cnpj) === raiz);
  const conhecida = filiais.length > 0;
  if (!conhecida && r() < 0.08) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<dbCredinfar>\n  <informacoes/>\n  <balancos/>\n</dbCredinfar>`;
    return { resultado: "SEM_DADOS", httpStatus: 200, xml, ficha: null, duracaoMs: duracaoBase, bytes: xml.length };
  }
  const principal = conhecida ? filiais[0] : empresaSintetica(raiz, r);
  const dataBase = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1); // D-1
  const avaliacao = avaliacaoDe(conhecida ? principal.risco : null, r);

  // Fontes negociais anonimizadas (até 10, excluindo a própria associada)
  const totalFontes = 3 + Math.floor(r() * 14);
  const nFontes = Math.min(LIMITE_FONTES_NEGOCIAIS, totalFontes);
  const fontes: FonteNegocial[] = [];
  for (let i = 0; i < nFontes; i++) {
    const escala = 0.15 + r() * 1.2;
    const atual = Math.round(principal.debitoAtual * escala);
    const pctVenc = Math.max(0, Math.min(0.6, (principal.debitoVencido / Math.max(1, principal.debitoAtual)) * (0.5 + r())));
    const venc = Math.round(atual * pctVenc);
    const f = [0.35, 0.25, 0.2, 0.1, 0.06, 0.04].map((p) => Math.round(venc * p)) as [number, number, number, number, number, number];
    f[0] += venc - f.reduce((t, v) => t + v, 0);
    const desde = new Date(2012 + Math.floor(r() * 12), Math.floor(r() * 12), 1);
    fontes.push({
      fonte: `Fonte ${String(i + 1).padStart(2, "0")}`,
      dataAtualizacao: dataBr(new Date(dataBase.getTime() - Math.floor(r() * 5) * 86400000)),
      clienteDesde: mesAno(desde),
      maiorSaldo: Math.round(atual * (1.05 + r() * 0.4)),
      ultimaCompra: Math.round(atual * (0.02 + r() * 0.15)),
      mediaAtraso: Math.floor(r() * (avaliacao === "A" ? 4 : avaliacao === "E" ? 90 : 25)),
      limite: r() < 0.3 ? 0 : Math.round(atual * (1.1 + r() * 0.6) / 1000) * 1000,
      debitoAtual: atual,
      debitoVencido: venc,
      vencidos: f,
    });
  }
  fontes.sort((a, b) => b.debitoAtual - a.debitoAtual);
  const debitoAtualRede = fontes.reduce((t, f) => t + f.debitoAtual, 0);
  const debitoVencidoRede = fontes.reduce((t, f) => t + f.debitoVencido, 0);
  const percentualVencido = debitoAtualRede > 0 ? (debitoVencidoRede / debitoAtualRede) * 100 : 0;

  // Séries mensais (informacaoComplementar): 12 meses até D-1
  const serieMeses: FichaResumo["serieMeses"] = [];
  for (let m = 11; m >= 0; m--) {
    const d = new Date(dataBase.getFullYear(), dataBase.getMonth() - m, 1);
    const fator = 0.7 + r() * 0.6;
    serieMeses.push({
      mes: mesAno(d),
      compra: Math.round((debitoAtualRede / 3) * fator),
      debito: Math.round(debitoAtualRede * (0.8 + r() * 0.4)),
      vencido: Math.round(debitoVencidoRede * (0.6 + r() * 0.8)),
      dso: Math.round(20 + r() * 40),
      consultas: Math.floor(r() * 8),
    });
  }
  const consultasMes = serieMeses[serieMeses.length - 1].consultas + Math.floor(r() * 6);
  const consultas30d = consultasMes + Math.floor(r() * 12);

  const pesoRuim = avaliacao === "E" ? 1 : avaliacao === "D" ? 0.5 : avaliacao === "C" ? 0.15 : 0.03;
  const ocorrencias = {
    protestos: r() < pesoRuim ? 1 + Math.floor(r() * 4) : 0,
    cheques: r() < pesoRuim * 0.6 ? 1 + Math.floor(r() * 3) : 0,
    acoes: r() < pesoRuim * 0.5 ? 1 + Math.floor(r() * 2) : 0,
    falencias: avaliacao === "E" && r() < 0.35 ? 1 : 0,
    inadimplencias: r() < pesoRuim * 0.7 ? 1 + Math.floor(r() * 3) : 0,
    valorProtestos: 0,
  };
  ocorrencias.valorProtestos = ocorrencias.protestos > 0 ? Math.round((2000 + r() * 40000) * ocorrencias.protestos) : 0;
  const socios = [NOMES_SOCIOS[Math.floor(r() * NOMES_SOCIOS.length)], NOMES_SOCIOS[Math.floor(r() * NOMES_SOCIOS.length)]].filter((v, i, a) => a.indexOf(v) === i);
  const simples = r() < 0.25 ? "OPTANTE PELO SIMPLES NACIONAL" : "NAO OPTANTE PELO SIMPLES NACIONAL";
  const sintegra = avaliacao === "E" && r() < 0.3 ? "SUSPENSO" : "ATIVO";

  // Balanços: 3 últimos períodos ou nenhum
  const temBalanco = r() < 0.7;
  const balancos: IndicadoresBalanco[] = [];
  if (temBalanco) {
    const receitaBase = Math.round(debitoAtualRede * (6 + r() * 10));
    for (let k = 2; k >= 0; k--) {
      const ano = dataBase.getFullYear() - 1 - k;
      const cresc = 1 + (k - 1) * -0.08 + (r() - 0.5) * 0.1;
      const receita = Math.round(receitaBase * cresc);
      const margem = (avaliacao <= "B" ? 0.06 : avaliacao === "C" ? 0.02 : -0.03) + (r() - 0.5) * 0.04;
      const ativo = Math.round(receita * (0.6 + r() * 0.5));
      const pl = Math.round(ativo * (avaliacao <= "B" ? 0.45 : avaliacao === "C" ? 0.3 : 0.12) * (0.8 + r() * 0.4));
      const liqCorrente = Math.round((avaliacao <= "B" ? 1.4 : avaliacao === "C" ? 1.1 : 0.8) * (0.85 + r() * 0.3) * 100) / 100;
      const liqGeral = Math.round(liqCorrente * (0.8 + r() * 0.3) * 100) / 100;
      const liqSeca = Math.round(liqCorrente * (0.5 + r() * 0.3) * 100) / 100;
      const endivGeral = Math.round(((ativo - pl) / Math.max(1, ativo)) * 100);
      const rentPL = (receita * margem) / Math.max(1, pl);
      const kanitz = Math.round((0.05 * rentPL + 1.65 * liqGeral + 3.55 * liqSeca - 1.06 * liqCorrente - 0.33 * (endivGeral / 100)) * 1000) / 1000;
      const nota = Math.max(1, Math.min(10, Math.round(5 + (kanitz > 0 ? 2 : -2) + (liqCorrente - 1) * 3 + margem * 20)));
      balancos.push({
        dataBalanco: `31/12/${ano}`,
        ativoTotal: ativo,
        patrimonioLiquido: pl,
        receitaLiquida: receita,
        lucroLiquido: Math.round(receita * margem),
        liqCorrente,
        liqGeral,
        liqSeca,
        endivGeral,
        kanitz,
        conceitoGlobal: CONCEITOS[Math.min(4, Math.max(0, Math.round(5 - nota / 2)))],
        notaGlobal: nota,
      });
    }
  }

  const ficha: FichaResumo = {
    cnpjRaiz: raiz,
    nome: principal.nome,
    nomeFantasia: principal.nome.split(" ").slice(0, 2).join(" "),
    situacaoCadastral: sintegra === "SUSPENSO" ? "SUSPENSA" : "ATIVA",
    cnae: principal.cnae,
    naturezaJuridica: principal.naturezaJuridica,
    cidade: principal.cidade,
    uf: principal.uf,
    grupoEconomico: principal.grupoEconomico,
    canal: principal.canal,
    dataBase: dataBr(dataBase),
    avaliacao,
    frases: FRASES_RISCO[avaliacao],
    debitoAtualRede,
    debitoVencidoRede,
    percentualVencido,
    fontes,
    totalFontes,
    consultasMes,
    consultas30d,
    serieMeses,
    ocorrencias,
    simples,
    sintegra,
    socios,
    balancos,
  };
  const xml = montarXml(ficha, principal, filiais.length > 0 ? filiais : [principal], dataBase);
  return { resultado: "OK", httpStatus: 200, xml, ficha, duracaoMs: duracaoBase + Math.round(xml.length / 60), bytes: xml.length };
}

// XML no formato do manual: blocos em ordem alfabética dentro de <dbCredinfar>.
function montarXml(f: FichaResumo, p: Cliente, filiais: Cliente[], dataBase: Date): string {
  const L: string[] = [`<?xml version="1.0" encoding="UTF-8"?>`, `<dbCredinfar>`];
  const dataConsulta = dataBr(dataBase);
  const bloco = (nome: string, corpo: string[]) => {
    if (corpo.length === 0) L.push(`  <${nome}/>`);
    else L.push(`  <${nome}>`, ...corpo.map((l) => "    " + l), `  </${nome}>`);
  };
  const oc = f.ocorrencias;

  bloco("acoes", Array.from({ length: oc.acoes }, (_, i) => `<acao>${tag("autor", "FAZENDA PUBLICA DO ESTADO")}${tag("cidade", f.cidade)}${tag("cnpjReu", formatarCnpj(p.cnpj))}${tag("comarca", f.cidade)}${tag("dtAjuizamento", `1${i}/03/${dataBase.getFullYear() - 1}`)}${tag("dtCadastro", dataConsulta)}${tag("forum", "FORO CENTRAL CIVEL")}${tag("processoNumero", `10${i}0${f.cnpjRaiz}202${i}`)}${tag("processoTipo", "EXECUCAO FISCAL")}${tag("uf", f.uf)}${tag("valor", "0,00")}${tag("vara", `${i + 1} VARA DA FAZENDA PUBLICA`)}</acao>`));
  bloco("administradores", f.socios.slice(0, 1).map((s) => `<administrador>${tag("cnpjCpf", "***.***.***-**")}${tag("dataConsulta", dataConsulta)}${tag("nomeAdministrador", s)}</administrador>`));
  bloco("alertas", f.avaliacao >= "D" ? [`<alerta>${tag("alerta", "Incluído no relatório semanal de Performance")}${tag("dtCadastro", dataConsulta)}</alerta>`] : []);
  // balancoAnalise, balancoComentario, balancoConceito, balancoDemonsFluxoCaixa, balancoIndicesPadraoAno, balancos, balancosIndices
  if (f.balancos.length === 0) {
    for (const b of ["balancoAnalise", "balancoComentario", "balancoConceito", "balancoDemonsFluxoCaixa", "balancoIndicesPadraoAno", "balancos", "balancosIndices"]) bloco(b, []);
  } else {
    const ult = f.balancos[f.balancos.length - 1];
    bloco("balancoAnalise", [
      `<frases>${tag("frase", `A gestão do fluxo de caixa ${ult.lucroLiquido >= 0 ? "NÃO impactou" : "impactou"} de forma significativa o equilíbrio financeiro. O grau de capitalização permaneceu: ${ult.endivGeral > 70 ? "INSUFICIENTE" : "ADEQUADO"}`)}${tag("frase", `(a) - A capacidade de geração de caixa foi ${ult.lucroLiquido > 0 ? "CONSIDERÁVEL" : "REDUZIDA"}.`)}${tag("frase", `Considerando os aspectos apontados, o risco financeiro pode ser considerado ${ult.kanitz > 0 ? "MODERADO" : "ELEVADO"}`)}</frases>`,
      tag("indCCR", num(100 + ult.liqCorrente * 20)), tag("indCEX", dec(ult.liqGeral * 3)), tag("indCGC", dec(ult.liqSeca * 5)), tag("indEFI", "0"), tag("indFREE", dec(ult.lucroLiquido / Math.max(1, ult.receitaLiquida) * 10)),
      tag("resFinanciamentos", num(ult.ativoTotal * 0.02)), tag("resInvestimentos", num(-ult.ativoTotal * 0.15)), tag("resOperacoes", num(ult.lucroLiquido * 1.4)), tag("varEBITDA", num(ult.lucroLiquido * 1.8)), tag("varFreeCashFlow", num(ult.lucroLiquido * 0.6)),
    ]);
    bloco("balancoComentario", [tag("comEndivCapTerceiros", `${ult.endivGeral}%`), tag("comEndivCapProprio", `${100 - ult.endivGeral}%`), tag("comIndiceLiqCorrente", dec(ult.liqCorrente, 2)), tag("comIndiceLiqGeral", dec(ult.liqGeral, 2)), tag("comIndiceLiqSeca", dec(ult.liqSeca, 2)), tag("comRentLucroLiquido", `${Math.round((ult.lucroLiquido / Math.max(1, ult.receitaLiquida)) * 100)}%`)]);
    bloco("balancoConceito", [tag("conLiqCorrente", ult.liqCorrente >= 1.3 ? "BOM" : ult.liqCorrente >= 1 ? "RAZOÁVEL" : "FRACO"), tag("conLiqGeral", ult.liqGeral >= 1.2 ? "BOM" : "RAZOÁVEL"), tag("conLiqSeca", ult.liqSeca >= 0.8 ? "BOM" : "FRACO"), tag("conEstEndivGeral", ult.endivGeral <= 50 ? "BOM" : ult.endivGeral <= 70 ? "RAZOÁVEL" : "DEFICIENTE"), tag("conceitoGlobal", ult.conceitoGlobal), tag("notaGlobal", ult.notaGlobal), tag("notaLiqCorrente", Math.min(10, Math.round(ult.liqCorrente * 5))), tag("notaTotalLiquidez", Math.min(10, Math.round((ult.liqCorrente + ult.liqGeral + ult.liqSeca) * 2)))]);
    bloco("balancoDemonsFluxoCaixa", [tag("caixaLiquidoAtividadesOperacionais", num(ult.lucroLiquido * 1.4)), tag("caixaLiquidoAtividadesInvestimentos", num(-ult.ativoTotal * 0.15)), tag("caixaLiquidoAtividadesFinanciamentos", num(ult.ativoTotal * 0.02)), tag("EBTIDA", num(ult.lucroLiquido * 1.8)), tag("variacaoCaixaEquivalentesCaixa", num(ult.lucroLiquido * 0.6))]);
    // balancoIndicesPadraoAno: página 5 (suporte para análise dos índices) excluída pelo material de regras
    bloco("balancoIndicesPadraoAno", []);
    bloco("balancos", f.balancos.map((b) => `<balanco>${tag("ativoCirculante", num(b.ativoTotal * 0.62))}${tag("ativoCirculanteAV", 62)}${tag("ativoNaoCirculante", num(b.ativoTotal * 0.38))}${tag("ativoNaoCirculanteAV", 38)}${tag("ativoTotal", num(b.ativoTotal))}${tag("ativoTotalAV", 100)}${tag("dataBalanco", b.dataBalanco)}${tag("demonsReceitaLiquida", num(b.receitaLiquida))}${tag("demonsLucroBruto", num(b.receitaLiquida * 0.28))}${tag("demonsLucPrejOperacional", num(b.lucroLiquido * 1.3))}${tag("demonsLucPrejLiquido", num(b.lucroLiquido))}${tag("numeroCNPJ", formatarCnpj(p.cnpj))}${tag("passivoCirculante", num(b.ativoTotal * 0.62 / Math.max(0.5, b.liqCorrente)))}${tag("passivoCapitalTerceiros", num(b.ativoTotal - b.patrimonioLiquido))}${tag("passivoPatrimonioLiquido", num(b.patrimonioLiquido))}${tag("passivoTotal", num(b.ativoTotal))}</balanco>`));
    bloco("balancosIndices", f.balancos.map((b, i) => `<balancoIndices>${tag("capCapitalGiro", num(b.ativoTotal * 0.62 - b.ativoTotal * 0.62 / Math.max(0.5, b.liqCorrente)))}${tag("codSegmento", Number(p.segmento))}${tag("dtaIndices", b.dataBalanco)}${tag("estEndivGeral", `${b.endivGeral}%`)}${tag("idBalanco", i + 1)}${tag("liqCorrente", dec(b.liqCorrente, 2))}${tag("liqGeral", dec(b.liqGeral, 2))}${tag("liqSeca", dec(b.liqSeca, 2))}${tag("modKanitzFatorInsolvencia", dec(b.kanitz, 3))}${tag("przMedioRecebimento", 25 + i * 3)}${tag("przMedioPagamento", 52 - i * 2)}${tag("resMargemLiquida", `${Math.round((b.lucroLiquido / Math.max(1, b.receitaLiquida)) * 100)}%`)}${tag("resRentPatLiquido", `${Math.round((b.lucroLiquido / Math.max(1, b.patrimonioLiquido)) * 100)}%`)}</balancoIndices>`));
  }
  bloco("cadastroJuridico", [tag("cep", p.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")), tag("cidade", f.cidade), tag("cnaePrincipal", f.cnae), tag("dataAbertura", `01/${p.clienteDesde.slice(0, 2)}/${Number(p.clienteDesde.slice(2)) - 4}`), tag("dataConsulta", dataConsulta), tag("dataSituacaoCadastral", "03/11/2005"), tag("endereco", p.endereco), tag("enderecoEletronico", `FISCAL@${f.nomeFantasia.replace(/\s+/g, "").toUpperCase()}.COM.BR`), tag("estado", f.uf), tag("naturezaJuridica", f.naturezaJuridica), tag("nomeEmpresarial", f.nome), tag("nomeFantasia", f.nomeFantasia), tag("situacaoCadastral", f.situacaoCadastral), tag("telefone", "11 30000000")]);
  bloco("cheques", Array.from({ length: oc.cheques }, (_, i) => `<cheque>${tag("bancoAgencia", 1600 + i)}${tag("bancoCode", "001")}${tag("codigoMotivo", 12)}${tag("cpfCnpj", soDigitos(p.cnpj))}${tag("descricaoMotivo", "Devolução por falta de fundos, 2ª apresentação")}${tag("dtCadastro", dataConsulta)}${tag("dtUltima", `1${i}/05/${dataBase.getFullYear()}`)}${tag("nrCnpjCpf", formatarCnpj(p.cnpj))}${tag("quantidade", 1 + i)}${tag("tipoPessoa", "Jurídica")}</cheque>`));
  bloco("dadosCadastro", [tag("canal", f.canal), tag("cep", p.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")), tag("cidade", f.cidade), tag("cnpjCpf", `${f.cnpjRaiz.slice(0, 2)}.${f.cnpjRaiz.slice(2, 5)}.${f.cnpjRaiz.slice(5)}`), tag("endereco", p.endereco), tag("estado", f.uf), tag("nome", f.nome), tag("ultimaAtualizacao", `Cx. 122-0 em ${dataConsulta}`)]);
  bloco("debitoConsolidados", filiais.map((c) => {
    const venc = c.debitoVencido;
    return `<debitoConsolidado>${tag("cnpjCpf", soDigitos(c.cnpj))}${tag("cnpjCpfFormatado", formatarCnpj(c.cnpj))}${tag("flgJuridico", "G")}${tag("nome", c.nome)}${tag("percentualVencido", dec(c.debitoAtual > 0 ? (venc / c.debitoAtual) * 100 : 0))}${tag("uf", c.uf)}${tag("valorDebitoAtual", num(c.debitoAtual))}${tag("valorDebitoVencido", num(venc))}${tag("valorVencido01", num(c.vencidos.d01))}${tag("valorVencido11", num(c.vencidos.d11))}${tag("valorVencido181", num(c.vencidos.d181))}${tag("valorVencido31", num(c.vencidos.d31))}${tag("valorVencido361", num(c.vencidos.d361))}${tag("valorVencido91", num(c.vencidos.d91))}</debitoConsolidado>`;
  }));
  bloco("falencias", oc.falencias ? [`<falencia>${tag("autor", f.nome)}${tag("cidade", f.cidade)}${tag("cnpjReu", formatarCnpj(p.cnpj))}${tag("comarca", f.cidade)}${tag("currentStatus", "EM PROCESSAMENTO")}${tag("dtAjuizamento", `12/01/${dataBase.getFullYear()}`)}${tag("dtCadastro", dataConsulta)}${tag("forum", "FORO DA CAPITAL")}${tag("processoNumero", `80${f.cnpjRaiz}2026`)}${tag("processoTipo", "RECUPERACAO JUDICIAL")}${tag("uf", f.uf)}${tag("valor", "0,00")}${tag("vara", "1 VARA EMPRESARIAL")}</falencia>`] : []);
  bloco("grupoEconomico", f.grupoEconomico ? [tag("nome", f.grupoEconomico)] : []);
  bloco("historicoPerformances", [
    `<historicoPerformance>${tag("debitoAtual", num(f.debitoAtualRede))}${tag("debitoVencidos", num(f.debitoVencidoRede))}${tag("dtAtualizado", dataConsulta)}${tag("estatus", f.avaliacao >= "D" ? "ENTRADA" : "SAIDA")}${tag("percentualVencidos", dec(f.percentualVencido, 2))}</historicoPerformance>`,
    `<historicoPerformance>${tag("debitoAtual", num(f.serieMeses[10].debito))}${tag("debitoVencidos", num(f.serieMeses[10].vencido))}${tag("dtAtualizado", dataBr(new Date(dataBase.getTime() - 7 * 86400000)))}${tag("estatus", "ENTRADA")}${tag("percentualVencidos", dec(f.serieMeses[10].debito > 0 ? (f.serieMeses[10].vencido / f.serieMeses[10].debito) * 100 : 0, 2))}</historicoPerformance>`,
  ]);
  bloco("inadimplencia", Array.from({ length: oc.inadimplencias }, (_, i) => `<inadimplencia>${tag("cidade", f.cidade)}${tag("cpfCnpj", soDigitos(p.cnpj))}${tag("credorCnpj", "**.***.***/****-**")}${tag("credorRazao", "CREDOR NAO IDENTIFICADO")}${tag("descricaoNatureza", "Outras Operações")}${tag("dtCadastro", dataConsulta)}${tag("dtDisponibilidade", dataConsulta)}${tag("dtOcorrencia", `1${i}/0${(i % 8) + 1}/${dataBase.getFullYear()}`)}${tag("numeroContrato", `00523${i}2000000000`)}${tag("tipoParticipacao", "Principal")}${tag("uf", f.uf)}${tag("valor", dec(300 + i * 1250.5, 2))}</inadimplencia>`));
  L.push(`  <informacaoComplementar consultasMes="${f.consultasMes}" consultasNosUltimo30D="${f.consultas30d}" totalFontes="${f.totalFontes}">`);
  const serie = (nome: string, item: string, sel: (m: FichaResumo["serieMeses"][number]) => string | number) => L.push(`    <${nome}>${f.serieMeses.map((m) => tag(item, sel(m))).join("")}</${nome}>`);
  serie("compraMeses", "compraMes", (m) => num(m.compra));
  serie("debitoAtuais", "debitoAtual", (m) => num(m.debito));
  serie("debitoVencidos", "debitoVencido", (m) => num(m.vencido));
  serie("dsoAssociados", "dsoAssociado", (m) => m.dso);
  serie("dsoCredinfars", "dsoCredinfar", (m) => Math.round(m.dso * 1.1));
  serie("meses", "mes", (m) => m.mes);
  serie("nroConsultas", "nroConsulta", (m) => m.consultas);
  serie("nroFonteCMs", "nroFonteCM", () => f.totalFontes);
  L.push(`  </informacaoComplementar>`);
  bloco("informacoes", f.fontes.map((x) => `<informacao>${tag("dataAtualizacao", x.dataAtualizacao)}${tag("dataClienteDesde", x.clienteDesde)}${tag("dataMaiorSaldoReportado", f.serieMeses[8].mes)}${tag("dataUltimaCompra", f.serieMeses[11].mes)}${tag("mediaAtraso", x.mediaAtraso)}${tag("valorDebitoAtual", num(x.debitoAtual))}${tag("valorDebitoVencido", num(x.debitoVencido))}${x.limite ? tag("valorLimiteCredito", num(x.limite)) : "<valorLimiteCredito/>"}${tag("valorMaiorSaldoReportado", num(x.maiorSaldo))}${tag("valorUltimaCompra", num(x.ultimaCompra))}${tag("valorVencido01", num(x.vencidos[0]))}${tag("valorVencido11", num(x.vencidos[1]))}${tag("valorVencido181", num(x.vencidos[4]))}${tag("valorVencido31", num(x.vencidos[2]))}${tag("valorVencido361", num(x.vencidos[5]))}${tag("valorVencido91", num(x.vencidos[3]))}</informacao>`));
  bloco("outrasEmpresasAdministradas", f.grupoEconomico ? [`<outrasEmpresasAdministrada>${tag("administrador", f.socios[0])}${tag("cnpj", f.cnpjRaiz.split("").reverse().join(""))}${tag("razaoSocial", `${f.grupoEconomico} PARTICIPACOES S A`)}</outrasEmpresasAdministrada>`] : []);
  bloco("protestos", Array.from({ length: oc.protestos }, (_, i) => `<protesto>${tag("cartorio", `${i + 1}º TABELIONATO DE PROTESTO DE TITULOS`)}${tag("cidade", f.cidade)}${tag("cnpj", formatarCnpj(p.cnpj))}${tag("cnpjPprotestado", formatarCnpj(p.cnpj))}${tag("dtCadastro", dataConsulta)}${tag("dtProtesto", `0${(i % 9) + 1}/0${(i % 8) + 1}/${dataBase.getFullYear()}`)}${tag("endereco", "RUA DO PROTESTO, 100")}${tag("estado", f.uf)}${tag("telefone", "1133000000")}${tag("valor", dec(oc.valorProtestos / oc.protestos, 2))}</protesto>`));
  bloco("qsas", f.socios.map((s, i) => `<qsa>${tag("dataConsulta", dataConsulta)}${tag("nomeSocio", s)}${tag("qualificacao", i === 0 ? "SOCIO-ADMINISTRADOR" : "DIRETOR")}</qsa>`));
  bloco("riskRating", [tag("avaliacaoAtual", f.avaliacao), tag("dataCRR", dataConsulta), `<frases>${f.frases.map((x) => tag("frase", x)).join("")}</frases>`]);
  bloco("simples", [tag("dataConsulta", dataConsulta), tag("optanteSimei", "NAO ENQUADRADO NO SIMEI"), tag("optanteSimeiPeriodoAnterior", "NAO EXISTEM"), tag("optanteSimples", f.simples), tag("optanteSimplesPeriodoAnterior", "NAO EXISTEM")]);
  bloco("sintegra", [tag("dataConsulta", dataConsulta), tag("dataSituacaoCadastral", "01/01/2010"), tag("inscricaoEstadual", `1${f.cnpjRaiz}11`), tag("regimeApuracao", "NORMAL REGIME PERIODICO DE APURACAO"), tag("situacalCadastral", f.sintegra)]);
  L.push(`</dbCredinfar>`);
  return L.join("\n");
}
