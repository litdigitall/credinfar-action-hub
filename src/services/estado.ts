// Estado do protótipo e operações do fluxo. Persistência local (navegador),
// suficiente para a demonstração; a camada de base de dados compartilhada é a
// evolução natural (ver docs/README.md).
import type {
  Acao,
  OpcaoAcao,
  Sinal,
  Cliente,
  Consulta,
  DecisaoAcao,
  EstadoHub,
  Parametros,
  RegistroAuditoria,
  Remessa,
  StatusRemessa,
} from "../models/types";
import { ROTULO_DECISAO } from "../models/types";
import { consultarCredinfar, type RespostaCredinfar } from "../engine/credinfarMock";
import { gerarInfassoc } from "../engine/infassoc";
import { ajustarSequenciaAcao, resumoValidacao, validarRemessa } from "../engine/regras";
import { lerCarteira } from "../engine/sinais";
import { brlInt, correlationId, hashCurto, raizCnpj } from "../engine/util";
import { estadoInicial, VERSAO_ESTADO } from "../data/seed";

const CHAVE = "credinfar-action-hub:estado";

export function carregarEstado(): EstadoHub {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      const e = JSON.parse(bruto) as EstadoHub;
      if (e.versao === VERSAO_ESTADO && Array.isArray(e.clientes) && e.clientes.length > 0) {
        ajustarSequenciaAcao(e.acoes.map((a) => a.id));
        return e;
      }
    }
  } catch {
    /* estado corrompido ou indisponível: recomeça */
  }
  const e = estadoInicial();
  salvarEstado(e);
  return e;
}

export function salvarEstado(e: EstadoHub): boolean {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(e));
    return true;
  } catch {
    return false;
  }
}

export function reiniciarEstado(): EstadoHub {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
  const e = estadoInicial();
  salvarEstado(e);
  return e;
}

// ---------------------------------------------------------------- utilidades
const agoraIso = () => new Date().toISOString();
let seqAud = 0;
function auditar(e: EstadoHub, usuario: string, acao: string, objeto: string, detalhe: string, corr?: string): RegistroAuditoria {
  seqAud = Math.max(seqAud, e.auditoria.length) + 1;
  return { id: `AUD-${String(seqAud).padStart(4, "0")}`, em: agoraIso(), usuario, acao, objeto, detalhe, correlationId: corr };
}
const comAuditoria = (e: EstadoHub, reg: RegistroAuditoria): EstadoHub => ({ ...e, auditoria: [reg, ...e.auditoria], atualizadoEm: agoraIso() });

export const clienteDe = (e: EstadoHub, id: string): Cliente | undefined => e.clientes.find((c) => c.id === id);
export const remessaCorrente = (e: EstadoHub): Remessa | undefined => e.remessas.find((r) => r.status !== "SENT") ?? e.remessas[0];
export const acoesDaRemessa = (e: EstadoHub, remessaId: string) => e.acoes.filter((a) => a.remessaId === remessaId);

function transicao(r: Remessa, para: StatusRemessa, usuario: string, detalhe: string): Remessa {
  return { ...r, status: para, historico: [...r.historico, { em: agoraIso(), usuario, de: r.status, para, detalhe }] };
}

// Recalcula prontidão/contadores da remessa a partir das ações.
function recalcular(e: EstadoHub, remessaId: string, usuario: string): EstadoHub {
  const r = e.remessas.find((x) => x.id === remessaId);
  if (!r) return e;
  const res = resumoValidacao(r.clienteIds, r.excluidos, acoesDaRemessa(e, remessaId));
  let nova: Remessa = { ...r, aprovadosAuto: res.aprovadosAuto, comAlerta: res.comAlerta, bloqueados: res.bloqueados, prontidao: res.prontidao, registros: r.clienteIds.length };
  if ((r.status === "ACTION_REQUIRED" || r.status === "PROCESSING") && res.bloqueados === 0) {
    nova = transicao(nova, "READY_FOR_APPROVAL", usuario, "Todos os bloqueios foram resolvidos");
  } else if (r.status === "READY_FOR_APPROVAL" && res.bloqueados > 0) {
    nova = transicao(nova, "ACTION_REQUIRED", usuario, `${res.bloqueados} bloqueio(s) pendente(s)`);
  }
  return { ...e, remessas: e.remessas.map((x) => (x.id === remessaId ? nova : x)) };
}

// ---------------------------------------------------------------- remessas
function proximoIdRemessa(e: EstadoHub): string {
  const [mes, ano] = e.parametros.competencia.split("/");
  const prefixo = `${ano}-${mes}-`;
  const seq = e.remessas.filter((r) => r.id.startsWith(prefixo)).reduce((m, r) => Math.max(m, Number(r.id.slice(-3)) || 0), 0) + 1;
  return `${prefixo}${String(seq).padStart(3, "0")}`;
}

// POST /api/v1/batches: nova remessa (ERP ou arquivo) → RECEIVED → PROCESSING → ACTION_REQUIRED | READY_FOR_APPROVAL
export function receberRemessa(e: EstadoHub, origem: Remessa["origem"], usuario: string, clientesNovos?: Cliente[]): { estado: EstadoHub; remessa: Remessa } {
  let estado = e;
  if (clientesNovos && clientesNovos.length > 0) {
    // Upsert por CNPJ: registros do arquivo substituem os da carteira
    const porCnpj = new Map(estado.clientes.map((c) => [c.cnpj, c]));
    let seq = estado.clientes.length;
    const atualizados = [...estado.clientes];
    for (const n of clientesNovos) {
      const existente = porCnpj.get(n.cnpj);
      if (existente) {
        const i = atualizados.findIndex((c) => c.id === existente.id);
        atualizados[i] = { ...existente, ...n, id: existente.id };
      } else {
        seq += 1;
        atualizados.push({ ...n, id: `C${String(seq).padStart(6, "0")}` });
      }
    }
    estado = { ...estado, clientes: atualizados };
  }
  const id = proximoIdRemessa(estado);
  const corr = correlationId();
  const em = agoraIso();
  const ids = estado.clientes.map((c) => c.id);
  let remessa: Remessa = {
    id,
    competencia: estado.parametros.competencia,
    origem,
    idempotencyKey: `${origem === "ERP" ? "ERP" : "ARQ"}-${estado.parametros.competencia.replace("/", "")}-${id.slice(-3)}`,
    correlationId: corr,
    recebidaEm: em,
    status: "RECEIVED",
    clienteIds: ids,
    excluidos: [],
    registros: ids.length,
    aprovadosAuto: 0,
    comAlerta: 0,
    bloqueados: 0,
    prontidao: 0,
    historico: [{ em, usuario: origem === "ERP" ? "API-ERP" : usuario, de: null, para: "RECEIVED", detalhe: `${ids.length.toLocaleString("pt-BR")} registros recebidos (${origem})` }],
  };
  remessa = transicao(remessa, "PROCESSING", "Motor de regras", "Validação técnica e de negócio");
  const acoes = validarRemessa(estado.clientes, id, estado.parametros.competencia, em);
  const res = resumoValidacao(ids, [], acoes);
  remessa = { ...remessa, aprovadosAuto: res.aprovadosAuto, comAlerta: res.comAlerta, bloqueados: res.bloqueados, prontidao: res.prontidao };
  remessa = transicao(remessa, res.bloqueados > 0 ? "ACTION_REQUIRED" : "READY_FOR_APPROVAL", "Motor de regras", `${res.bloqueados} bloqueios e ${res.comAlerta} alertas identificados`);
  // Remessas anteriores da mesma competência ainda não enviadas são substituídas (idempotência por competência)
  const remessas = [remessa, ...estado.remessas.filter((r) => r.status === "SENT")];
  const acoesMantidas = estado.acoes.filter((a) => remessas.some((r) => r.id === a.remessaId));
  estado = { ...estado, remessas, acoes: [...acoes, ...acoesMantidas] };
  estado = comAuditoria(estado, auditar(estado, origem === "ERP" ? "API-ERP" : usuario, "Carteira recebida", `Envio ${id}`, `${ids.length.toLocaleString("pt-BR")} clientes recebidos (${origem}).`, corr));
  estado = comAuditoria(estado, auditar(estado, "Motor de regras", "Conferência automática", `Envio ${id}`, `${res.bloqueados} travados e ${res.comAlerta} com aviso.`, corr));
  return { estado, remessa };
}

// Revalida a remessa corrente (após correções no cadastro): ações pendentes são recriadas; resolvidas ficam na trilha.
export function revalidarRemessa(e: EstadoHub, remessaId: string, usuario: string): EstadoHub {
  const r = e.remessas.find((x) => x.id === remessaId);
  if (!r || r.status === "SENT" || r.status === "GENERATED") return e;
  const em = agoraIso();
  const ativos = e.clientes.filter((c) => r.clienteIds.includes(c.id) && !r.excluidos.includes(c.id));
  const novas = validarRemessa(ativos, remessaId, r.competencia, em);
  const resolvidas = e.acoes.filter((a) => a.remessaId === remessaId && a.status === "RESOLVED");
  // Não recria uma pendência já decidida (mesmo cliente + código) nesta remessa
  const decididas = new Set(resolvidas.map((a) => `${a.clienteId}|${a.codigo}`));
  const pendentes = novas.filter((a) => !decididas.has(`${a.clienteId}|${a.codigo}`));
  let estado: EstadoHub = { ...e, acoes: [...pendentes, ...resolvidas, ...e.acoes.filter((a) => a.remessaId !== remessaId)] };
  const res = resumoValidacao(r.clienteIds, r.excluidos, acoesDaRemessa(estado, remessaId));
  let nova: Remessa = { ...r, aprovadosAuto: res.aprovadosAuto, comAlerta: res.comAlerta, bloqueados: res.bloqueados, prontidao: res.prontidao };
  if (nova.status === "APPROVED") nova = transicao(nova, "PROCESSING", usuario, "Revalidação após aprovação: aprovação desfeita");
  nova = transicao(nova, res.bloqueados > 0 ? "ACTION_REQUIRED" : "READY_FOR_APPROVAL", "Motor de regras", `Revalidação: ${res.bloqueados} bloqueios e ${res.comAlerta} alertas`);
  estado = { ...estado, remessas: estado.remessas.map((x) => (x.id === remessaId ? nova : x)) };
  return comAuditoria(estado, auditar(estado, usuario, "Nova conferência", `Envio ${remessaId}`, `${res.bloqueados} travados e ${res.comAlerta} com aviso.`, r.correlationId));
}

// POST /api/v1/actions/{id}/resolve
export function resolverAcao(e: EstadoHub, acaoId: string, decisao: DecisaoAcao, justificativa: string, alteracoes: Record<string, number | string>, usuario: string): EstadoHub {
  const a = e.acoes.find((x) => x.id === acaoId);
  if (!a || a.status === "RESOLVED") return e;
  const cliente = clienteDe(e, a.clienteId);
  if (!cliente) return e;
  const r = e.remessas.find((x) => x.id === a.remessaId);
  if (!r) return e;
  const antes: Record<string, number | string> = {};
  const depois: Record<string, number | string> = {};
  let clienteNovo: Cliente = { ...cliente };
  let excluidos = r.excluidos;

  const aplicar = (campo: keyof Cliente, valor: number | string) => {
    antes[campo] = cliente[campo] as number | string;
    depois[campo] = valor;
    (clienteNovo as unknown as Record<string, unknown>)[campo] = valor;
  };
  switch (decisao) {
    case "CORRIGIR_DOCUMENTO": {
      if (typeof alteracoes.cnpj === "string" && alteracoes.cnpj) aplicar("cnpj", alteracoes.cnpj.replace(/\D/g, ""));
      for (const campo of ["nome", "endereco", "cidade", "cep", "uf"] as const) {
        if (typeof alteracoes[campo] === "string" && alteracoes[campo]) aplicar(campo, String(alteracoes[campo]).toUpperCase());
      }
      break;
    }
    case "CORRIGIR_VALORES": {
      const v = { ...cliente.vencidos };
      let mudouFaixa = false;
      for (const faixa of ["d01", "d11", "d31", "d91", "d181", "d361"] as const) {
        if (typeof alteracoes[faixa] === "number") {
          antes[faixa] = cliente.vencidos[faixa];
          depois[faixa] = alteracoes[faixa];
          v[faixa] = Number(alteracoes[faixa]);
          mudouFaixa = true;
        }
      }
      if (mudouFaixa) clienteNovo = { ...clienteNovo, vencidos: v };
      if (typeof alteracoes.debitoVencido === "number") aplicar("debitoVencido", alteracoes.debitoVencido);
      if (typeof alteracoes.debitoAtual === "number") aplicar("debitoAtual", alteracoes.debitoAtual);
      if (typeof alteracoes.limite === "number") aplicar("limite", alteracoes.limite);
      break;
    }
    case "ACEITAR_ORIGEM": {
      // Aceita o valor da origem: as faixas passam a fechar com o débito vencido (diferença vai para 31 a 90 dias)
      const soma = cliente.vencidos.d01 + cliente.vencidos.d11 + cliente.vencidos.d31 + cliente.vencidos.d91 + cliente.vencidos.d181 + cliente.vencidos.d361;
      const dif = cliente.debitoVencido - soma;
      if (dif !== 0) {
        antes.d31 = cliente.vencidos.d31;
        depois.d31 = cliente.vencidos.d31 + dif;
        clienteNovo = { ...clienteNovo, vencidos: { ...cliente.vencidos, d31: cliente.vencidos.d31 + dif } };
      }
      break;
    }
    case "ALTERAR_LIMITE": {
      if (typeof alteracoes.limite === "number") aplicar("limite", alteracoes.limite);
      break;
    }
    case "EXCLUIR_DA_REMESSA":
    case "RETIRAR_DA_REMESSA": {
      if (!excluidos.includes(cliente.id)) excluidos = [...excluidos, cliente.id];
      antes.naRemessa = "sim";
      depois.naRemessa = "não";
      break;
    }
    default:
      break; // MANTER_DADOS, MANTER_NA_REMESSA, SOLICITAR_REVISAO: só registro
  }
  const em = agoraIso();
  const resolvida: Acao = { ...a, status: "RESOLVED", decisao, justificativa, antes, depois, resolvidaPor: usuario, resolvidaEm: em };
  // Se o cliente saiu da remessa, as demais pendências dele deixam de contar (ficam resolvidas por exclusão)
  const acoes = e.acoes.map((x) => {
    if (x.id === acaoId) return resolvida;
    if ((decisao === "EXCLUIR_DA_REMESSA" || decisao === "RETIRAR_DA_REMESSA") && x.remessaId === a.remessaId && x.clienteId === a.clienteId && x.status === "PENDING") {
      return { ...x, status: "RESOLVED" as const, decisao, justificativa: `Cliente retirado da remessa (${a.id}).`, resolvidaPor: usuario, resolvidaEm: em };
    }
    return x;
  });
  let estado: EstadoHub = {
    ...e,
    clientes: e.clientes.map((c) => (c.id === cliente.id ? clienteNovo : c)),
    acoes,
    remessas: e.remessas.map((x) => (x.id === r.id ? { ...x, excluidos } : x)),
  };
  // Correções podem eliminar ou criar outras pendências do mesmo cliente: reavalia só ele
  if (decisao === "CORRIGIR_DOCUMENTO" || decisao === "CORRIGIR_VALORES" || decisao === "ACEITAR_ORIGEM" || decisao === "ALTERAR_LIMITE") {
    const novas = validarRemessa([clienteNovo], r.id, r.competencia, em);
    const jaDecididas = new Set(estado.acoes.filter((x) => x.remessaId === r.id && x.clienteId === cliente.id && x.status === "RESOLVED").map((x) => x.codigo));
    const pendentesAntigas = estado.acoes.filter((x) => x.remessaId === r.id && x.clienteId === cliente.id && x.status === "PENDING");
    const manter = estado.acoes.filter((x) => !pendentesAntigas.includes(x));
    estado = { ...estado, acoes: [...novas.filter((n) => !jaDecididas.has(n.codigo)), ...manter] };
  }
  estado = recalcular(estado, r.id, usuario);
  const mudancas = Object.keys(depois).length ? ` Alterações: ${Object.keys(depois).map((k) => `${k}: ${antes[k]} → ${depois[k]}`).join("; ")}.` : "";
  return comAuditoria(estado, auditar(estado, usuario, "Correção ou retirada", `${cliente.nome} · ${a.id}`, `${ROTULO_DECISAO[decisao]}. Justificativa: ${justificativa}${mudancas}`, r.correlationId));
}

export function podeAprovar(e: EstadoHub, remessaId: string): { ok: boolean; motivo: string } {
  const r = e.remessas.find((x) => x.id === remessaId);
  if (!r) return { ok: false, motivo: "Remessa não encontrada." };
  const bloqueios = acoesDaRemessa(e, remessaId).filter((a) => a.status === "PENDING" && a.tipo === "BLOCKER" && !r.excluidos.includes(a.clienteId)).length;
  if (bloqueios > 0) return { ok: false, motivo: `${bloqueios} bloqueio(s) pendente(s) na Central de Ações.` };
  if (r.status !== "READY_FOR_APPROVAL" && r.status !== "ACTION_REQUIRED") return { ok: false, motivo: `A remessa está em "${r.status}".` };
  return { ok: true, motivo: "" };
}

// POST /api/v1/batches/{id}/approve
export function aprovarRemessa(e: EstadoHub, remessaId: string, usuario: string): { estado: EstadoHub; erro?: string } {
  const p = podeAprovar(e, remessaId);
  if (!p.ok) return { estado: e, erro: p.motivo };
  const r = e.remessas.find((x) => x.id === remessaId)!;
  const em = agoraIso();
  const nova = transicao({ ...r, aprovadaPor: usuario, aprovadaEm: em }, "APPROVED", usuario, "Aprovação manual registrada");
  let estado: EstadoHub = { ...e, remessas: e.remessas.map((x) => (x.id === remessaId ? nova : x)) };
  estado = comAuditoria(estado, auditar(estado, usuario, "Envio aprovado", `Envio ${remessaId}`, `${(r.registros - r.excluidos.length).toLocaleString("pt-BR")} clientes aprovados (${r.excluidos.length} tirados do envio).`, r.correlationId));
  return { estado };
}

// POST /api/v1/batches/{id}/generate: INFASSOC.SIC (só depois da aprovação)
export function gerarArquivoRemessa(e: EstadoHub, remessaId: string, usuario: string): { estado: EstadoHub; conteudo?: string; erro?: string } {
  const r = e.remessas.find((x) => x.id === remessaId);
  if (!r) return { estado: e, erro: "Remessa não encontrada." };
  if (r.status !== "APPROVED" && r.status !== "GENERATED") return { estado: e, erro: "A geração do arquivo exige a aprovação da remessa." };
  const clientes = e.clientes.filter((c) => r.clienteIds.includes(c.id) && !r.excluidos.includes(c.id));
  const g = gerarInfassoc(clientes, e.parametros.codAssociada);
  if (g.problemas.length > 0) {
    return { estado: e, erro: `${g.problemas.length} registro(s) não couberam no layout: ${g.problemas.slice(0, 3).map((p) => `${p.clienteId} (${p.motivo})`).join("; ")}.` };
  }
  const em = agoraIso();
  const arquivo = { nome: "INFASSOC.SIC" as const, registros: g.registros, largura: 270 as const, geradoEm: em, geradoPor: usuario, hash: g.hash, bytes: g.bytes };
  let nova: Remessa = { ...r, arquivo };
  if (r.status === "APPROVED") nova = transicao(nova, "GENERATED", usuario, `INFASSOC.SIC gerado: ${g.registros.toLocaleString("pt-BR")} registros de 270 posições`);
  let estado: EstadoHub = { ...e, remessas: e.remessas.map((x) => (x.id === remessaId ? nova : x)) };
  estado = comAuditoria(estado, auditar(estado, usuario, "Arquivo gerado", "INFASSOC.SIC", `${g.registros.toLocaleString("pt-BR")} clientes, 270 posições por linha, conferência ${g.hash}.`, r.correlationId));
  return { estado, conteudo: g.conteudo };
}

// Conteúdo do arquivo (recalculado: o estado não guarda o texto de 800 KB)
export function conteudoArquivo(e: EstadoHub, remessaId: string): string {
  const r = e.remessas.find((x) => x.id === remessaId);
  if (!r) return "";
  const clientes = e.clientes.filter((c) => r.clienteIds.includes(c.id) && !r.excluidos.includes(c.id));
  return gerarInfassoc(clientes, e.parametros.codAssociada).conteudo;
}

// Envio simulado à Credinfar (o arquivo é entregue pelo canal acordado; aqui só o protocolo)
export function enviarRemessa(e: EstadoHub, remessaId: string, usuario: string): { estado: EstadoHub; erro?: string } {
  const r = e.remessas.find((x) => x.id === remessaId);
  if (!r) return { estado: e, erro: "Remessa não encontrada." };
  if (r.status !== "GENERATED" || !r.arquivo) return { estado: e, erro: "Gere o INFASSOC.SIC antes de enviar." };
  const em = agoraIso();
  const protocolo = `CRD-${r.competencia.replace("/", "")}-${hashCurto(r.arquivo.hash + em).slice(0, 6)}`;
  const nova = transicao({ ...r, enviadaEm: em, enviadaPor: usuario, protocolo }, "SENT", usuario, `Enviada à Credinfar, protocolo ${protocolo}`);
  let estado: EstadoHub = { ...e, remessas: e.remessas.map((x) => (x.id === remessaId ? nova : x)) };
  // A remessa enviada passa a ser a base da quota do próximo ciclo (1,5x os registros enviados)
  estado = comAuditoria(estado, auditar(estado, usuario, "Envio à Credinfar", `Envio ${remessaId}`, `${r.arquivo.registros.toLocaleString("pt-BR")} clientes, protocolo ${protocolo}.`, r.correlationId));
  return { estado };
}

// ---------------------------------------------------------------- consultas Credinfar
export function consultasNoCiclo(e: EstadoHub): number {
  const [mes, ano] = e.parametros.competencia.split("/").map(Number);
  const daSessao = e.consultas.filter((c) => {
    const d = new Date(c.em);
    return d.getMonth() + 1 === mes && d.getFullYear() === ano && c.resultado !== "IP_NAO_AUTORIZADO" && c.resultado !== "TOKEN_INVALIDO";
  }).length;
  return e.parametros.consultasNoMes + daSessao;
}

export function consultar(e: EstadoHub, cnpjRaiz: string, usuario: string): { estado: EstadoHub; resposta: RespostaCredinfar; consulta: Consulta } {
  const raiz = cnpjRaiz.replace(/\D/g, "").slice(0, 8);
  const resposta = consultarCredinfar(raiz, e.parametros, e.clientes, consultasNoCiclo(e));
  const cliente = e.clientes.find((c) => raizCnpj(c.cnpj) === raiz) ?? null;
  const corr = correlationId("CRH-CON");
  const consulta: Consulta = {
    id: `CON-${String(e.consultas.length + 1).padStart(4, "0")}`,
    em: agoraIso(),
    usuario,
    cnpjRaiz: raiz,
    clienteId: cliente?.id ?? null,
    resultado: resposta.resultado,
    duracaoMs: resposta.duracaoMs,
    bytes: resposta.bytes,
    balancos: resposta.ficha?.balancos.length ?? 0,
    correlationId: corr,
    ipOrigem: e.parametros.ipSaida,
  };
  let estado: EstadoHub = { ...e, consultas: [consulta, ...e.consultas] };
  estado = comAuditoria(estado, auditar(estado, usuario, "Consulta Credinfar", cliente ? cliente.nome : `CNPJ raiz ${raiz}`, `${resposta.resultado === "OK" ? "Respondida" : "Não respondida: " + resposta.resultado} em ${resposta.duracaoMs} ms (${resposta.bytes.toLocaleString("pt-BR")} bytes).`, corr));
  return { estado, resposta, consulta };
}

// ---------------------------------------------------------------- parâmetros
export function atualizarParametros(e: EstadoHub, p: Parametros, usuario: string): EstadoHub {
  const mudou = (Object.keys(p) as (keyof Parametros)[]).filter((k) => p[k] !== e.parametros[k]);
  const estado: EstadoHub = { ...e, parametros: p };
  if (mudou.length === 0) return estado;
  return comAuditoria(estado, auditar(estado, usuario, "Configuração alterada", "Configurações", `Campos: ${mudou.filter((k) => k !== "token").join(", ")}${mudou.includes("token") ? ", token" : ""}.`));
}

// Métricas para o dashboard
export function metricas(e: EstadoHub) {
  const r = remessaCorrente(e);
  const acoes = r ? acoesDaRemessa(e, r.id) : [];
  const pend = acoes.filter((a) => a.status === "PENDING" && !(r?.excluidos ?? []).includes(a.clienteId));
  const ativos = r ? e.clientes.filter((c) => r.clienteIds.includes(c.id) && !r.excluidos.includes(c.id)) : e.clientes;
  const carteira = ativos.reduce((t, c) => t + c.debitoAtual, 0);
  const vencido = ativos.reduce((t, c) => t + c.debitoVencido, 0);
  const acima90 = ativos.reduce((t, c) => t + c.vencidos.d91 + c.vencidos.d181 + c.vencidos.d361, 0);
  const faixas = ativos.reduce(
    (t, c) => ({ d01: t.d01 + c.vencidos.d01, d11: t.d11 + c.vencidos.d11, d31: t.d31 + c.vencidos.d31, d91: t.d91 + c.vencidos.d91, d181: t.d181 + c.vencidos.d181, d361: t.d361 + c.vencidos.d361 }),
    { d01: 0, d11: 0, d31: 0, d91: 0, d181: 0, d361: 0 }
  );
  const porRisco = { Baixo: 0, Médio: 0, Alto: 0, Crítico: 0 } as Record<Cliente["risco"], number>;
  for (const c of ativos) porRisco[c.risco] += 1;
  const [mes, ano] = e.parametros.competencia.split("/").map(Number);
  const proximoEnvio = new Date(ano, mes, e.parametros.diaEnvio); // dia N do mês seguinte
  return {
    remessa: r,
    pendentes: pend.length,
    criticas: pend.filter((a) => a.severidade === "Crítica").length,
    importantes: pend.filter((a) => a.severidade === "Importante").length,
    informativas: pend.filter((a) => a.severidade === "Informativa").length,
    bloqueios: pend.filter((a) => a.tipo === "BLOCKER").length,
    carteira,
    vencido,
    acima90,
    faixas,
    porRisco,
    clientesAtivos: ativos.length,
    proximoEnvio,
    quotaLimite: Math.floor(e.parametros.registrosMesAnterior * 1.5),
    quotaUsada: consultasNoCiclo(e),
    decisoesAbertas: e.sinais.filter((x) => x.status === "ABERTO").length,
  };
}

// ---------------------------------------------------------------- processo simples
// Para quem usa, o envio do mês tem três situações. Os sete estados do
// workflow continuam no histórico (auditoria), mas não aparecem na tela.
export type StatusSimples = "Em preparação" | "Pronta" | "Enviada";
export function statusSimples(r: Remessa): StatusSimples {
  if (r.status === "SENT") return "Enviada";
  if (r.status === "READY_FOR_APPROVAL" || r.status === "APPROVED" || r.status === "GENERATED") return "Pronta";
  return "Em preparação";
}

// Um botão só: aprova, gera o INFASSOC.SIC e envia. Para no primeiro problema.
export function enviarTudo(e: EstadoHub, remessaId: string, usuario: string): { estado: EstadoHub; conteudo?: string; erro?: string } {
  const r0 = e.remessas.find((x) => x.id === remessaId);
  if (!r0) return { estado: e, erro: "Envio não encontrado." };
  if (r0.status === "SENT") return { estado: e, erro: "Este envio já foi feito." };
  let atual = e;
  if (r0.status !== "APPROVED" && r0.status !== "GENERATED") {
    const a = aprovarRemessa(atual, remessaId, usuario);
    if (a.erro) return { estado: e, erro: a.erro };
    atual = a.estado;
  }
  const g = gerarArquivoRemessa(atual, remessaId, usuario);
  if (g.erro) return { estado: atual, erro: g.erro };
  const s = enviarRemessa(g.estado, remessaId, usuario);
  if (s.erro) return { estado: g.estado, erro: s.erro };
  return { estado: s.estado, conteudo: g.conteudo };
}

// ---------------------------------------------------------------- do dado à decisão
// Leitura mensal da carteira na Credinfar: consulta os clientes de maior débito
// dentro do limite do mês (guardando uma reserva para o dia a dia) e monta a
// lista de decisões. Decisões já tomadas neste mês não voltam para a lista.
export function atualizarCarteira(e: EstadoHub, usuario: string): { estado: EstadoHub; erro?: string; consultados: number; novos: number } {
  const r = lerCarteira(e.clientes, e.parametros, consultasNoCiclo(e));
  if (r.erro) return { estado: e, erro: r.erro, consultados: 0, novos: 0 };
  const decididos = e.sinais.filter((x) => x.status === "DECIDIDO");
  const jaDecidido = new Set(decididos.map((x) => x.id));
  const abertos = r.sinais.filter((x) => !jaDecidido.has(x.id));
  let estado: EstadoHub = {
    ...e,
    sinais: [...abertos, ...decididos],
    varredura: { em: agoraIso(), consultados: r.consultados, semQuota: r.semQuota, porNota: r.porNota, leituras: r.leituras },
    parametros: { ...e.parametros, consultasNoMes: e.parametros.consultasNoMes + r.consultados },
  };
  estado = comAuditoria(estado, auditar(estado, usuario, "Carteira atualizada na Credinfar", "Carteira", `${r.consultados.toLocaleString("pt-BR")} clientes consultados; ${abertos.length} pedem decisão${r.semQuota ? `; ${r.semQuota} ficaram de fora pelo limite do mês` : ""}.`));
  return { estado, consultados: r.consultados, novos: abertos.length };
}

export interface ExtrasDecisao {
  novoLimite?: number;
  nota?: string;
  promessaEm?: string; // AAAA-MM-DD
}

// Registra a decisão, aplica o efeito no cliente e tira o cartão da lista.
export function registrarDecisao(e: EstadoHub, clienteId: string, opcao: OpcaoAcao, extras: ExtrasDecisao, usuario: string): EstadoHub {
  const c = clienteDe(e, clienteId);
  if (!c) return e;
  let novo: Cliente = c;
  let detalhe = opcao.rotulo;
  let acaoAud = "Decisão de crédito";
  if (opcao.acao === "AJUSTAR_LIMITE") {
    const limite = Math.max(0, Math.round(extras.novoLimite ?? opcao.novoLimite ?? c.limite));
    detalhe = `Limite de ${brlInt(c.limite)} para ${brlInt(limite)}`;
    novo = { ...c, limite };
  } else if (opcao.acao === "PEDIR_GARANTIA") {
    detalhe = "Novas vendas só com garantia ou pagamento antecipado";
    novo = { ...c, condicao: "Garantia ou pagamento antecipado" };
  } else if (opcao.acao === "BLOQUEAR_VENDAS") {
    detalhe = "Novas vendas a prazo seguradas";
    novo = { ...c, bloqueado: true };
  } else if (opcao.acao === "REGISTRAR_CONTATO") {
    acaoAud = "Cobrança registrada";
    detalhe = `Contato de cobrança${extras.promessaEm ? `, prometeu pagar em ${extras.promessaEm.split("-").reverse().join("/")}` : ""}`;
  } else {
    detalhe = "Sem mudança: só acompanhar";
  }
  if (extras.nota) detalhe += `. ${extras.nota}`;
  const em = agoraIso();
  const sinais: Sinal[] = e.sinais.map((x) => (x.clienteId === clienteId && x.status === "ABERTO" ? { ...x, status: "DECIDIDO", decisao: { acao: opcao.acao, rotulo: opcao.rotulo, detalhe, usuario, em } } : x));
  const estado: EstadoHub = { ...e, clientes: e.clientes.map((x) => (x.id === clienteId ? novo : x)), sinais };
  return comAuditoria(estado, auditar(estado, usuario, acaoAud, c.nome, `${detalhe}.`));
}

// Desfaz o bloqueio ou a condição especial do cliente
export function liberarCliente(e: EstadoHub, clienteId: string, usuario: string): EstadoHub {
  const c = clienteDe(e, clienteId);
  if (!c) return e;
  const estado: EstadoHub = { ...e, clientes: e.clientes.map((x) => (x.id === clienteId ? { ...x, bloqueado: false, condicao: undefined } : x)) };
  return comAuditoria(estado, auditar(estado, usuario, "Decisão de crédito", c.nome, "Vendas a prazo liberadas novamente."));
}
