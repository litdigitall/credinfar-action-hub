// Carteira e estado inicial da demonstração (determinísticos).
// Os seis clientes nomeados reproduzem os casos do Documento Mestre (§11.2 e
// Apêndice B); os demais são sintéticos, gerados com semente fixa, para dar a
// volumetria de uma remessa real (3.000 registros, dezenas de alertas, poucos
// bloqueios).
import type { Acao, Cliente, Consulta, EstadoHub, Parametros, PontoHistorico, RegistroAuditoria, Remessa, Segmento } from "../models/types";
import { ajustarSequenciaAcao, resumoValidacao, validarRemessa } from "../engine/regras";
import { lerCarteira } from "../engine/sinais";
import { montarCnpj, prng, hashCurto } from "../engine/util";

export const VERSAO_ESTADO = 8;
export const TOTAL_CLIENTES = 3000;

const CIDADES: { cidade: string; uf: string; cep: string }[] = [
  { cidade: "SAO PAULO", uf: "SP", cep: "01" }, { cidade: "SAO PAULO", uf: "SP", cep: "04" }, { cidade: "CAMPINAS", uf: "SP", cep: "13" },
  { cidade: "RIBEIRAO PRETO", uf: "SP", cep: "14" }, { cidade: "RIO DE JANEIRO", uf: "RJ", cep: "20" }, { cidade: "NITEROI", uf: "RJ", cep: "24" },
  { cidade: "BELO HORIZONTE", uf: "MG", cep: "30" }, { cidade: "UBERLANDIA", uf: "MG", cep: "38" }, { cidade: "CURITIBA", uf: "PR", cep: "80" },
  { cidade: "LONDRINA", uf: "PR", cep: "86" }, { cidade: "FLORIANOPOLIS", uf: "SC", cep: "88" }, { cidade: "ITAJAI", uf: "SC", cep: "88" },
  { cidade: "PORTO ALEGRE", uf: "RS", cep: "90" }, { cidade: "SALVADOR", uf: "BA", cep: "40" }, { cidade: "RECIFE", uf: "PE", cep: "50" },
  { cidade: "FORTALEZA", uf: "CE", cep: "60" }, { cidade: "GOIANIA", uf: "GO", cep: "74" }, { cidade: "BRASILIA", uf: "DF", cep: "70" },
  { cidade: "MANAUS", uf: "AM", cep: "69" }, { cidade: "BELEM", uf: "PA", cep: "66" }, { cidade: "VITORIA", uf: "ES", cep: "29" },
];
const PREFIXOS: Record<Segmento, string[]> = {
  "00": ["DROGARIA", "FARMACIA", "DROGAL", "REDE FARMA", "DISTRIBUIDORA FARMACEUTICA", "FARMACIAS", "HOSPITAL", "CLINICA", "DROGARIAS"],
  "01": ["CLINICA VETERINARIA", "AGROPET", "PET CENTER", "DISTRIBUIDORA VETERINARIA", "AGROPECUARIA", "COOPERATIVA AGRICOLA"],
  "02": ["COSMETICOS", "PERFUMARIA", "ATACADO DE BELEZA", "DISTRIBUIDORA DE CONSUMO", "SUPERMERCADOS", "MAGAZINE"],
};
const NOMES = ["HORIZONTE", "BOA VIDA", "CENTRAL", "SAO JOSE", "NOSSA SENHORA", "POPULAR", "DO POVO", "ALIANCA", "UNIAO", "PRIMAVERA", "ESPERANCA", "BRASIL", "NACIONAL", "SAUDE TOTAL", "VITAL", "BEM ESTAR", "MODERNA", "IMPERIAL", "PAULISTA", "MINEIRA", "GAUCHA", "CARIOCA", "NORDESTE", "ATLANTICA", "PACIFICO", "SANTA CLARA", "SAO LUCAS", "SANTA RITA", "AURORA", "ESTRELA", "DIAMANTE", "PLATINA", "GLOBAL", "PRIME", "MAX", "PLUS", "LIDER", "MASTER", "TOP", "IDEAL"];
const SUFIXOS = ["LTDA", "LTDA", "LTDA", "S A", "EIRELI", "ME", "LTDA EPP"];
const CANAIS: Record<Segmento, string[]> = {
  "00": ["Rede de Farmácia", "Farmácia Independente", "Distribuidor", "Hospital/Clínica"],
  "01": ["Clínica Veterinária", "Agropecuária", "Distribuidor"],
  "02": ["Varejo de Consumo", "Atacado", "E-commerce"],
};
const CNAE: Record<Segmento, string> = {
  "00": "4771701 - Comércio varejista de produtos farmacêuticos, sem manipulação de fórmulas",
  "01": "4771704 - Comércio varejista de medicamentos veterinários",
  "02": "4772500 - Comércio varejista de cosméticos, produtos de perfumaria e de higiene pessoal",
};
const NATUREZAS = ["2062 - Sociedade Empresária Limitada", "2054 - Sociedade Anônima Fechada", "2135 - Empresário (Individual)", "2305 - Empresa Individual de Responsabilidade Limitada"];

const mm = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`;

function distribuirVencido(vencido: number, r: () => number, comAcima90: boolean) {
  const pesos = comAcima90 ? [0.2, 0.2, 0.25, 0.15, 0.12, 0.08] : [0.45, 0.3, 0.25, 0, 0, 0];
  const ruido = pesos.map((p) => p * (0.7 + r() * 0.6));
  const soma = ruido.reduce((t, v) => t + v, 0) || 1;
  const f = ruido.map((p) => Math.round((vencido * p) / soma));
  f[0] += vencido - f.reduce((t, v) => t + v, 0);
  return { d01: f[0], d11: f[1], d31: f[2], d91: f[3], d181: f[4], d361: f[5] };
}

function riscoDe(c: { debitoAtual: number; debitoVencido: number; limite: number; vencidos: Cliente["vencidos"] }): Cliente["risco"] {
  const pct = c.debitoAtual > 0 ? c.debitoVencido / c.debitoAtual : 0;
  const acima90 = c.vencidos.d91 + c.vencidos.d181 + c.vencidos.d361;
  if (acima90 > 0 && (acima90 / Math.max(1, c.debitoVencido) > 0.5 || c.debitoAtual > c.limite)) return "Crítico";
  if (pct > 0.25 || c.debitoAtual > c.limite) return "Alto";
  if (pct > 0.08) return "Médio";
  return "Baixo";
}

// Cliente sintético determinístico (índice + semente)
function clienteSintetico(i: number, r: () => number, hoje: Date): Cliente {
  const seg: Segmento = r() < 0.72 ? "00" : r() < 0.6 ? "01" : "02";
  const local = CIDADES[Math.floor(r() * CIDADES.length)];
  const nome = `${PREFIXOS[seg][Math.floor(r() * PREFIXOS[seg].length)]} ${NOMES[Math.floor(r() * NOMES.length)]} ${SUFIXOS[Math.floor(r() * SUFIXOS.length)]}`;
  const raiz = String(10000000 + Math.floor(r() * 89999999));
  const limite = Math.round((15000 + Math.pow(r(), 2) * 600000) / 1000) * 1000;
  // Consumo do limite: a maioria abaixo de 85%; ~1,5% da carteira perto ou acima do limite
  const sorteioConsumo = r();
  const consumo = sorteioConsumo < 0.015 ? 0.9 + r() * 0.25 : r() * 0.85;
  const debitoAtual = r() < 0.02 ? 0 : Math.round(limite * consumo);
  const pctVenc = r() < 0.55 ? 0 : Math.pow(r(), 2) * 0.45;
  const debitoVencido = Math.round(debitoAtual * pctVenc);
  const comAcima90 = debitoVencido > 0 && r() < 0.03;
  const vencidos = distribuirVencido(debitoVencido, r, comAcima90);
  const mesesUltCompra = debitoAtual === 0 ? Math.floor(r() * 14) : Math.floor(r() * 2);
  const ult = new Date(hoje.getFullYear(), hoje.getMonth() - mesesUltCompra, 1);
  const desde = new Date(2008 + Math.floor(r() * 17), Math.floor(r() * 12), 1);
  const c: Cliente = {
    id: `C${String(i).padStart(6, "0")}`,
    cnpj: montarCnpj(raiz, r() < 0.9 ? "0001" : String(2 + Math.floor(r() * 30)).padStart(4, "0")),
    nome,
    endereco: `${["RUA", "AV", "AL", "ROD"][Math.floor(r() * 4)]} ${NOMES[Math.floor(r() * NOMES.length)]}, ${100 + Math.floor(r() * 3000)}`,
    cidade: local.cidade,
    cep: local.cep + String(Math.floor(r() * 1000000)).padStart(6, "0"),
    uf: local.uf,
    segmento: seg,
    clienteDesde: mm(desde),
    ultimaCompra: { data: mm(ult), valor: Math.round(limite * (0.02 + r() * 0.2)) },
    maiorNota: { data: mm(new Date(hoje.getFullYear(), hoje.getMonth() - Math.floor(r() * 18), 1)), valor: Math.round(limite * (0.1 + r() * 0.5)) },
    maiorAcumulo: { data: mm(new Date(hoje.getFullYear(), hoje.getMonth() - Math.floor(r() * 12), 1)), valor: Math.round(limite * (0.6 + r() * 0.6)) },
    limite,
    diasAtraso: debitoVencido > 0 ? Math.floor(3 + r() * (comAcima90 ? 90 : 25)) : 0,
    debitoAtual,
    debitoVencido,
    compraMes: { data: mm(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), valor: debitoAtual === 0 ? 0 : Math.round(limite * r() * 0.4) },
    vencidos,
    risco: "Baixo",
    canal: CANAIS[seg][Math.floor(r() * CANAIS[seg].length)],
    cnae: CNAE[seg],
    naturezaJuridica: NATUREZAS[Math.floor(r() * NATUREZAS.length)],
    grupoEconomico: r() < 0.08 ? `GRUPO ${NOMES[Math.floor(r() * NOMES.length)]}` : "",
  };
  c.risco = riscoDe(c);
  return c;
}

// Os seis clientes do Documento Mestre (Apêndice B.1 e §11.2)
function clientesNomeados(): Cliente[] {
  const base = (id: string, nome: string, cnpj: string, seg: Segmento, cep: string, limite: number, atual: number, vencido: number, vencidos: Cliente["vencidos"], extra: Partial<Cliente> = {}): Cliente => ({
    id,
    cnpj,
    nome,
    endereco: "RUA EXEMPLO, 100",
    cidade: "SAO PAULO",
    cep,
    uf: "SP",
    segmento: seg,
    clienteDesde: "012019",
    ultimaCompra: { data: "082026", valor: Math.round(atual * 0.12) },
    maiorNota: { data: "062026", valor: Math.round(atual * 0.35) },
    maiorAcumulo: { data: "072026", valor: Math.round(atual * 1.15) },
    limite,
    diasAtraso: vencido > 0 ? 18 : 0,
    debitoAtual: atual,
    debitoVencido: vencido,
    compraMes: { data: "082026", valor: Math.round(atual * 0.3) },
    vencidos,
    risco: "Médio",
    canal: CANAIS[seg][0],
    cnae: CNAE[seg],
    naturezaJuridica: NATUREZAS[0],
    grupoEconomico: "",
    ...extra,
  });
  const lista: Cliente[] = [
    // CNPJ do documento (12.345.678/0001-90) tem dígitos de controle inválidos → BLOCKER
    base("C000001", "DROGARIA HORIZONTE LTDA", "12345678000190", "00", "05500000", 150000, 142000, 56000, { d01: 20000, d11: 16000, d31: 12000, d91: 8000, d181: 0, d361: 0 }, { risco: "Crítico", endereco: "AV HORIZONTE, 1200", diasAtraso: 34 }),
    // Aging inconsistente: faixas somam 16.000 e o vencido informado é 18.400
    base("C000002", "FARMACIA BOA VIDA LTDA", montarCnpj("45222111"), "00", "01310930", 100000, 74000, 18400, { d01: 9000, d11: 4600, d31: 2400, d91: 0, d181: 0, d361: 0 }, { endereco: "AV PAULISTA, 1000", risco: "Médio" }),
    // Exposição acima do limite
    base("C000003", "VETPRIME DISTRIBUIDORA LTDA", montarCnpj("38444777"), "01", "04567001", 200000, 216000, 83000, { d01: 30000, d11: 25000, d31: 20000, d91: 8000, d181: 0, d361: 0 }, { risco: "Crítico", endereco: "RUA DOS ANIMAIS, 88", diasAtraso: 27 }),
    // Vencidos acima de 90 dias
    base("C000004", "COSMETIKA BRASIL S A", montarCnpj("27100900"), "02", "06454000", 350000, 288000, 82000, { d01: 10000, d11: 6000, d31: 4000, d91: 32000, d181: 20000, d361: 10000 }, { risco: "Alto", cidade: "BARUERI", endereco: "AL ARAGUAIA, 500", diasAtraso: 71, grupoEconomico: "GRUPO COSMETIKA" }),
    // Limite próximo do consumo total (91%)
    base("C000005", "DROGARIA CENTRAL LTDA", montarCnpj("09021552"), "00", "05001000", 160000, 145600, 21000, { d01: 12000, d11: 6000, d31: 3000, d91: 0, d181: 0, d361: 0 }, { endereco: "RUA CENTRAL, 45" }),
    // Sem movimentação recente
    base("C000006", "SAUDE & CIA FARMACIA LTDA", montarCnpj("61234567"), "00", "03000000", 40000, 0, 0, { d01: 0, d11: 0, d31: 0, d91: 0, d181: 0, d361: 0 }, { ultimaCompra: { data: "012026", valor: 1800 }, compraMes: { data: "082026", valor: 0 }, risco: "Baixo", endereco: "RUA DA SAUDE, 12" }),
  ];
  return lista;
}

export function gerarClientes(total = TOTAL_CLIENTES, hoje = new Date(2026, 8, 16)): Cliente[] {
  const r = prng(20260916);
  const nomeados = clientesNomeados();
  const lista: Cliente[] = [...nomeados];
  const raizes = new Set(nomeados.map((c) => c.cnpj.slice(0, 8)));
  for (let i = nomeados.length + 1; lista.length < total; i++) {
    const c = clienteSintetico(i, r, hoje);
    if (raizes.has(c.cnpj.slice(0, 8))) continue;
    raizes.add(c.cnpj.slice(0, 8));
    lista.push(c);
  }
  // Anomalias controladas para a demonstração (bloqueios além dos nomeados)
  const anom = prng(777);
  const escolher = () => lista[7 + Math.floor(anom() * (lista.length - 7))];
  for (let k = 0; k < 3; k++) {
    const c = escolher();
    c.cnpj = c.cnpj.slice(0, 12) + "00"; // dígitos de controle errados
  }
  for (let k = 0; k < 4; k++) {
    const c = escolher();
    if (c.debitoVencido > 0) c.debitoVencido += 1000 + Math.round(anom() * 5000);
  }
  const semCep = escolher();
  semCep.cep = "";
  const semUf = escolher();
  semUf.uf = "";
  return lista;
}

export function parametrosIniciais(): Parametros {
  return {
    codAssociada: "001",
    nomeAssociada: "Abbott Laboratórios do Brasil",
    login: "abbott.api",
    token: "TKN-HML-7F3A9C2E5B",
    endpointHomologacao: "https://dev.credinfar.com.br/consulta/control?cmd=consulta-consolidada-xml&nrCnpj=",
    endpointProducao: "(solicitar à Credinfar após a homologação)",
    ambiente: "homologacao",
    ipCadastrado: "200.155.10.42",
    ipSaida: "200.155.10.42",
    registrosMesAnterior: 2982,
    consultasNoMes: 204,
    competencia: "09/2026",
    diaEnvio: 8,
    criterioQuota: "registros",
  };
}

function historico(id: string, competencia: string, registros: number, recebidaEm: string, enviadaEm: string): Remessa {
  return {
    id,
    competencia,
    origem: "ERP",
    idempotencyKey: `ERP-${competencia.replace("/", "")}-${id.slice(-3)}`,
    correlationId: `CRH-HIST-${hashCurto(id).slice(0, 8)}`,
    recebidaEm,
    status: "SENT",
    clienteIds: [],
    excluidos: [],
    registros,
    aprovadosAuto: registros,
    comAlerta: 0,
    bloqueados: 0,
    prontidao: 100,
    aprovadaPor: "Leonardo",
    aprovadaEm: enviadaEm,
    arquivo: { nome: "INFASSOC.SIC", registros, largura: 270, geradoEm: enviadaEm, geradoPor: "Leonardo", hash: hashCurto(id + registros), bytes: registros * 272 },
    enviadaEm,
    enviadaPor: "Leonardo",
    protocolo: `CRD-${competencia.replace("/", "")}-${hashCurto(id).slice(0, 6)}`,
    historico: [
      { em: recebidaEm, usuario: "API-ERP", de: null, para: "RECEIVED", detalhe: `${registros.toLocaleString("pt-BR")} registros recebidos` },
      { em: recebidaEm, usuario: "Motor de regras", de: "RECEIVED", para: "READY_FOR_APPROVAL", detalhe: "Sem bloqueios" },
      { em: enviadaEm, usuario: "Leonardo", de: "READY_FOR_APPROVAL", para: "APPROVED", detalhe: "Aprovação manual" },
      { em: enviadaEm, usuario: "Leonardo", de: "APPROVED", para: "GENERATED", detalhe: "INFASSOC.SIC gerado" },
      { em: enviadaEm, usuario: "Leonardo", de: "GENERATED", para: "SENT", detalhe: "Enviada à Credinfar" },
    ],
  };
}

// Estado inicial completo: carteira, remessa corrente em ACTION_REQUIRED
// (como o protótipo do Documento Mestre), remessas históricas enviadas,
// balanços, consultas e auditoria.
// Doze meses da carteira até a competência corrente (tendência para as análises).
// Determinístico: débito oscila ±6%, vencido sobe devagar nos últimos meses.
export function gerarHistorico(clientes: Cliente[], competencia: string, notasDE: number): PontoHistorico[] {
  const r = prng(20260922);
  const [mes, ano] = competencia.split("/").map(Number);
  const debitoAtual = clientes.reduce((t, c) => t + c.debitoAtual, 0);
  const vencidoAtual = clientes.reduce((t, c) => t + c.debitoVencido, 0);
  const pctAtual = debitoAtual > 0 ? (vencidoAtual / debitoAtual) * 100 : 5;
  const pontos: PontoHistorico[] = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(ano, mes - 1 - k, 1);
    const fator = k === 0 ? 1 : 0.86 + (11 - k) * 0.012 + (r() - 0.5) * 0.03; // carteira cresce ~14% no ano
    const debito = Math.round(debitoAtual * fator);
    const pct = k === 0 ? pctAtual : Math.max(2.5, pctAtual - 0.9 + (11 - k) * 0.08 + (r() - 0.5) * 0.6 - (k > 8 ? 0.3 : 0));
    pontos.push({
      mes: `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`,
      debito,
      vencido: Math.round((debito * pct) / 100),
      pctVencido: Math.round(pct * 10) / 10,
      dso: Math.round(40 + (r() - 0.5) * 6 + (11 - k) * 0.3),
      enviados: k === 0 ? clientes.length : 2900 + Math.floor(r() * 90),
      notasDE: Math.round(notasDE * (k === 0 ? 1 : 0.85 + r() * 0.25)),
    });
  }
  return pontos;
}

export function estadoInicial(): EstadoHub {
  const agora = new Date().toISOString();
  const clientes = gerarClientes();
  const parametros = parametrosIniciais();
  ajustarSequenciaAcao([]);
  const remessaId = "2026-09-002";
  const recebidaEm = new Date(2026, 8, 2, 8, 12).toISOString();
  const acoes: Acao[] = validarRemessa(clientes, remessaId, parametros.competencia, recebidaEm);
  const res = resumoValidacao(clientes.map((c) => c.id), [], acoes);
  const remessa: Remessa = {
    id: remessaId,
    competencia: parametros.competencia,
    origem: "ERP",
    idempotencyKey: "ERP-092026-002",
    correlationId: "CRH-092026-002",
    recebidaEm,
    status: res.bloqueados > 0 ? "ACTION_REQUIRED" : "READY_FOR_APPROVAL",
    clienteIds: clientes.map((c) => c.id),
    excluidos: [],
    registros: clientes.length,
    aprovadosAuto: res.aprovadosAuto,
    comAlerta: res.comAlerta,
    bloqueados: res.bloqueados,
    prontidao: res.prontidao,
    historico: [
      { em: recebidaEm, usuario: "API-ERP", de: null, para: "RECEIVED", detalhe: `${clientes.length.toLocaleString("pt-BR")} registros recebidos via API-ERP` },
      { em: recebidaEm, usuario: "Motor de regras", de: "RECEIVED", para: "PROCESSING", detalhe: "Validação técnica e de negócio" },
      { em: recebidaEm, usuario: "Motor de regras", de: "PROCESSING", para: res.bloqueados > 0 ? "ACTION_REQUIRED" : "READY_FOR_APPROVAL", detalhe: `${res.bloqueados} bloqueios e ${res.comAlerta} alertas identificados` },
    ],
  };
  const auditoria: RegistroAuditoria[] = [
    { id: "AUD-0001", em: recebidaEm, usuario: "API-ERP", acao: "Carteira recebida", objeto: `Envio ${remessaId}`, detalhe: `${clientes.length.toLocaleString("pt-BR")} clientes recebidos do ERP.`, correlationId: "CRH-092026-002" },
    { id: "AUD-0002", em: recebidaEm, usuario: "Motor de regras", acao: "Conferência automática", objeto: `Envio ${remessaId}`, detalhe: `${res.bloqueados} travados e ${res.comAlerta} com aviso.`, correlationId: "CRH-092026-002" },
    { id: "AUD-0003", em: new Date(2026, 8, 3, 10, 38).toISOString(), usuario: "Leonardo", acao: "Consulta Credinfar", objeto: "COSMETIKA BRASIL S A", detalhe: "Ficha e balanços consultados (3 períodos)." },
  ];
  const consultas: Consulta[] = [
    { id: "CON-0001", em: new Date(2026, 8, 3, 10, 38).toISOString(), usuario: "Leonardo", cnpjRaiz: "27100900", clienteId: "C000004", resultado: "OK", duracaoMs: 812, bytes: 38210, balancos: 3, correlationId: "CRH-CON-0001", ipOrigem: parametros.ipSaida },
    { id: "CON-0002", em: new Date(2026, 8, 9, 15, 2).toISOString(), usuario: "Leonardo", cnpjRaiz: "09021552", clienteId: "C000005", resultado: "OK", duracaoMs: 655, bytes: 29870, balancos: 3, correlationId: "CRH-CON-0002", ipOrigem: parametros.ipSaida },
  ];
  // Leitura mensal da carteira já feita (rotina da madrugada, dados de ontem)
  const leitura = lerCarteira(clientes, parametros, parametros.consultasNoMes, new Date());
  const leituraEm = new Date(new Date().setHours(6, 10, 0, 0)).toISOString();
  parametros.consultasNoMes += leitura.consultados;
  auditoria.unshift({ id: "AUD-0004", em: leituraEm, usuario: "Rotina mensal", acao: "Carteira atualizada na Credinfar", objeto: "Carteira", detalhe: `${leitura.consultados.toLocaleString("pt-BR")} clientes consultados; ${leitura.sinais.length} pedem decisão.` });
  return {
    versao: VERSAO_ESTADO,
    sinais: leitura.sinais,
    varredura: { em: leituraEm, consultados: leitura.consultados, semQuota: leitura.semQuota, porNota: leitura.porNota, leituras: leitura.leituras },
    historicoCarteira: gerarHistorico(clientes, parametros.competencia, (leitura.porNota.D?.debito ?? 0) + (leitura.porNota.E?.debito ?? 0)),
    clientes,
    remessas: [
      remessa,
      historico("2026-08-008", "08/2026", 2982, new Date(2026, 7, 8, 8, 5).toISOString(), new Date(2026, 7, 8, 11, 30).toISOString()),
      historico("2026-08-004", "08/2026", 2971, new Date(2026, 7, 4, 8, 3).toISOString(), new Date(2026, 7, 4, 10, 15).toISOString()),
    ],
    acoes,
    consultas,
    auditoria,
    parametros,
    atualizadoEm: agora,
  };
}
