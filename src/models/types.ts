// Modelo de domínio do Credinfar Action Hub (protótipo funcional).
// Fonte: Documento Mestre Consolidado 16/09/2026, Manual Técnico API Web
// Credinfar V1.4 (07/2025) e layout oficial INFASSOC.SIC (LAYOUT CREDINFAR.pdf).

// Segmento da associada / cliente (layout INFASSOC.SIC, posições 004 a 005)
export type Segmento = "00" | "01" | "02";
export const SEGMENTOS: Record<Segmento, string> = {
  "00": "Farmacêutico",
  "01": "Veterinário",
  "02": "Cosmético/Consumo",
};

export type Risco = "Baixo" | "Médio" | "Alto" | "Crítico";

export interface DataValor {
  data: string; // MMAAAA
  valor: number; // inteiro, sem centavos (layout Numérico(2))
}

export interface Vencidos {
  d01: number; // 01 a 10 dias
  d11: number; // 11 a 30 dias
  d31: number; // 31 a 90 dias
  d91: number; // 91 a 180 dias
  d181: number; // 181 a 360 dias
  d361: number; // acima de 360 dias
}

// Cliente da carteira (origem ERP). É a unidade do registro INFASSOC.SIC.
export interface Cliente {
  id: string; // C000001
  cnpj: string; // 14 dígitos, sem máscara
  nome: string; // razão social
  endereco: string;
  cidade: string;
  cep: string; // 8 dígitos
  uf: string;
  segmento: Segmento;
  clienteDesde: string; // MMAAAA
  ultimaCompra: DataValor;
  maiorNota: DataValor;
  maiorAcumulo: DataValor;
  limite: number;
  diasAtraso: number;
  debitoAtual: number;
  debitoVencido: number;
  compraMes: DataValor;
  vencidos: Vencidos;
  risco: Risco;
  canal: string; // ex.: Rede de Farmácia, Distribuidor
  cnae: string;
  naturezaJuridica: string;
  grupoEconomico: string;
}

// Estados do workflow da remessa (Documento Mestre §11.3)
export type StatusRemessa =
  | "RECEIVED"
  | "PROCESSING"
  | "ACTION_REQUIRED"
  | "READY_FOR_APPROVAL"
  | "APPROVED"
  | "GENERATED"
  | "SENT";
export const ORDEM_STATUS: StatusRemessa[] = [
  "RECEIVED",
  "PROCESSING",
  "ACTION_REQUIRED",
  "READY_FOR_APPROVAL",
  "APPROVED",
  "GENERATED",
  "SENT",
];
export const ROTULO_STATUS: Record<StatusRemessa, string> = {
  RECEIVED: "Recebida",
  PROCESSING: "Em validação",
  ACTION_REQUIRED: "Ação necessária",
  READY_FOR_APPROVAL: "Pronta para aprovação",
  APPROVED: "Aprovada",
  GENERATED: "Arquivo gerado",
  SENT: "Enviada",
};

export interface EventoRemessa {
  em: string; // ISO
  usuario: string;
  de: StatusRemessa | null;
  para: StatusRemessa;
  detalhe: string;
}

export interface ArquivoGerado {
  nome: "INFASSOC.SIC";
  registros: number;
  largura: 270;
  geradoEm: string;
  geradoPor: string;
  hash: string; // hash simples do conteúdo (auditoria)
  bytes: number;
}

export interface Remessa {
  id: string; // 2026-09-002
  competencia: string; // MM/AAAA
  origem: "ERP" | "Arquivo" | "Demonstração";
  idempotencyKey: string; // ERP-092026-002
  correlationId: string;
  recebidaEm: string;
  status: StatusRemessa;
  clienteIds: string[]; // registros recebidos
  excluidos: string[]; // retirados por decisão do usuário
  registros: number; // recebidos
  aprovadosAuto: number; // sem nenhuma ação
  comAlerta: number; // com ação não bloqueante
  bloqueados: number; // com ação BLOCKER pendente
  prontidao: number; // % registros sem pendência bloqueante
  aprovadaPor?: string;
  aprovadaEm?: string;
  arquivo?: ArquivoGerado;
  enviadaEm?: string;
  enviadaPor?: string;
  protocolo?: string; // simulação do recibo Credinfar
  historico: EventoRemessa[];
}

// Ações da Central (Documento Mestre §11.2 e §12)
export type TipoAcao = "BLOCKER" | "DECISION" | "WARNING" | "INFO";
export type Severidade = "Crítica" | "Importante" | "Informativa";
export type CodigoAcao =
  | "CNPJ_INVALIDO"
  | "AGING_MISMATCH"
  | "CADASTRO_INCOMPLETO"
  | "VALOR_FORA_DO_LAYOUT"
  | "EXPOSICAO_ACIMA_LIMITE"
  | "VENCIDOS_ACIMA_90"
  | "LIMITE_PROXIMO"
  | "SEM_MOVIMENTACAO";
export type DecisaoAcao =
  | "CORRIGIR_DOCUMENTO"
  | "CORRIGIR_VALORES"
  | "ACEITAR_ORIGEM"
  | "EXCLUIR_DA_REMESSA"
  | "SOLICITAR_REVISAO"
  | "MANTER_DADOS"
  | "ALTERAR_LIMITE"
  | "RETIRAR_DA_REMESSA"
  | "MANTER_NA_REMESSA";
export const ROTULO_DECISAO: Record<DecisaoAcao, string> = {
  CORRIGIR_DOCUMENTO: "Corrigir cadastro",
  CORRIGIR_VALORES: "Corrigir valores",
  ACEITAR_ORIGEM: "Usar o valor do ERP",
  EXCLUIR_DA_REMESSA: "Tirar do envio",
  SOLICITAR_REVISAO: "Solicitar revisão",
  MANTER_DADOS: "Manter dados",
  ALTERAR_LIMITE: "Alterar limite",
  RETIRAR_DA_REMESSA: "Tirar do envio",
  MANTER_NA_REMESSA: "Manter no envio",
};

export interface Acao {
  id: string; // ACT-1042
  remessaId: string;
  clienteId: string;
  tipo: TipoAcao;
  severidade: Severidade;
  codigo: CodigoAcao;
  mensagem: string;
  detalhe: string;
  acoesDisponiveis: DecisaoAcao[];
  status: "PENDING" | "RESOLVED";
  criadaEm: string;
  decisao?: DecisaoAcao;
  justificativa?: string;
  antes?: Record<string, number | string>;
  depois?: Record<string, number | string>;
  resolvidaPor?: string;
  resolvidaEm?: string;
}

// Balanços / Public Disclosure (Documento Mestre §11 e Apêndice B.3)
export interface IndicadoresBalanco {
  dataBalanco: string; // DD/MM/AAAA
  ativoTotal: number;
  patrimonioLiquido: number;
  receitaLiquida: number;
  lucroLiquido: number;
  liqCorrente: number;
  liqGeral: number;
  liqSeca: number;
  endivGeral: number; // %
  kanitz: number; // fator de insolvência
  conceitoGlobal: string;
  notaGlobal: number;
}
// Consultas à API Credinfar (simuladas) e controle de quota
export type ResultadoConsulta =
  | "OK"
  | "SEM_DADOS"
  | "IP_NAO_AUTORIZADO"
  | "LIMITE_EXCEDIDO"
  | "TOKEN_INVALIDO";
export interface Consulta {
  id: string;
  em: string;
  usuario: string;
  cnpjRaiz: string;
  clienteId: string | null;
  resultado: ResultadoConsulta;
  duracaoMs: number;
  bytes: number;
  balancos: number; // quantos períodos vieram (0 a 3)
  correlationId: string;
  ipOrigem: string;
}

export interface RegistroAuditoria {
  id: string;
  em: string;
  usuario: string;
  acao: string;
  objeto: string;
  detalhe: string;
  correlationId?: string;
}

export interface Parametros {
  codAssociada: string; // 3 dígitos (layout, posições 001 a 003)
  nomeAssociada: string;
  login: string;
  token: string; // guardado só para simulação
  endpointHomologacao: string;
  endpointProducao: string;
  ambiente: "homologacao" | "producao";
  ipCadastrado: string;
  ipSaida: string; // IP público de saída simulado
  registrosMesAnterior: number; // base da quota (1,5x)
  consultasNoMes: number; // consumo já realizado no ciclo (antes das da sessão)
  competencia: string; // MM/AAAA
  diaEnvio: number; // dia do mês do próximo envio
  criterioQuota: "registros" | "clientes"; // divergência entre manual e material de regras
}

export interface EstadoHub {
  versao: number;
  clientes: Cliente[];
  remessas: Remessa[];
  acoes: Acao[];
  consultas: Consulta[];
  auditoria: RegistroAuditoria[];
  parametros: Parametros;
  atualizadoEm: string;
}
