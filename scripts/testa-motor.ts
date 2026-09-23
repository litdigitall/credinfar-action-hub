// Testes do motor do Credinfar Action Hub (sem navegador):
// CNPJ, layout INFASSOC.SIC (270 posições, regras do LAYOUT CREDINFAR),
// matriz de validação, workflow (bloqueio da aprovação), quota, IP e XML.
// Roda com: npm run testar
import { gerarInfassoc, LAYOUT, montarLinha, padN, validarLinha } from "../src/engine/infassoc";
import { avaliarCliente, resumoValidacao, validarRemessa } from "../src/engine/regras";
import { consultarCredinfar, LIMITE_FONTES_NEGOCIAIS, limiteQuota } from "../src/engine/credinfarMock";
import { cnpjValido, montarCnpj } from "../src/engine/util";
import { estadoInicial, gerarClientes, parametrosIniciais } from "../src/data/seed";
import { aprovarRemessa, consultar, enviarRemessa, enviarTudo, gerarArquivoRemessa, podeAprovar, receberRemessa, resolverAcao, statusSimples } from "../src/services/estado";
import { avaliar, lerCarteira, RESERVA_CONSULTAS } from "../src/engine/sinais";
import { analisar, NOTAS } from "../src/engine/analises";
import { atualizarCarteira, registrarDecisao } from "../src/services/estado";

let falhas = 0;
const check = (cond: boolean, msg: string) => {
  console.log((cond ? "OK " : "FALHA ") + msg);
  if (!cond) falhas += 1;
};

// 1) CNPJ
check(cnpjValido("61412110000155"), "CNPJ do manual (61.412.110/0001-55) válido");
check(!cnpjValido("12345678000190"), "CNPJ do documento mestre (12.345.678/0001-90) inválido (bloqueio esperado)");
check(cnpjValido(montarCnpj("45222111")), "montarCnpj gera dígitos de controle válidos");
check(!cnpjValido("11111111111111"), "sequência repetida inválida");

// 2) Layout oficial
check(LAYOUT.length === 30 && LAYOUT[LAYOUT.length - 1].fim === 270, "layout com 30 campos e 270 posições");
check(LAYOUT.every((c, i) => c.fim - c.inicio + 1 === c.tamanho && (i === 0 || c.inicio === LAYOUT[i - 1].fim + 1)), "campos contíguos e tamanhos coerentes");
const clientes = gerarClientes(400);
const c0 = clientes.find((c) => c.id === "C000002")!; // Farmácia Boa Vida (CNPJ válido)
const linha = montarLinha(c0, "001");
check(linha.length === 270, `linha do Boa Vida tem 270 posições (${linha.length})`);
check(linha.slice(0, 3) === "001" && linha.slice(3, 5) === "00" && linha[5] === "G", "posições 001 a 006: associada 001, segmento 00, tipo G");
check(linha.slice(6, 20) === c0.cnpj, "posições 007 a 020 trazem o CNPJ completo (raiz, complemento, controle)");
check(linha.slice(20, 60).startsWith("FARMACIA BOA VIDA LTDA"), "razão social nas posições 021 a 060");
check(linha.slice(120, 126) === "012019", "CLIENTE_DESDE em MMAAAA nas posições 121 a 126");
check(linha.slice(171, 180) === "000100000", "limite 100.000 nas posições 172 a 180 (inteiro, sem centavos)");
check(linha.slice(192, 201) === "000018400", "débito vencido 18.400 nas posições 193 a 201");
check(validarLinha(linha).length === 0, "linha passa nas regras (sem branco em 001 a 020 e a partir de 121)");
const semData = { ...c0, ultimaCompra: { data: "", valor: 0 }, cep: "01310930" };
const l2 = montarLinha(semData, "001");
check(l2.slice(126, 132) === "000000" && !/\s/.test(l2.slice(120)), "dado faltante a partir da posição 121 vira zeros");
let estourou = false;
try {
  padN(1_000_000_000, 9);
} catch {
  estourou = true;
}
check(estourou, "valor com 10 dígitos não cabe em 9 posições (erro, não truncamento)");
const arq = gerarInfassoc([c0, clientes[10], clientes[11]], "001");
check(arq.registros === 3 && arq.conteudo.split("\r\n").filter(Boolean).every((l) => l.length === 270), "arquivo com 3 registros, CRLF e 270 posições cada");
const acent = montarLinha({ ...c0, nome: "FARMÁCIA SÃO JOSÉ & CIA" }, "001");
check(acent.slice(20, 43) === "FARMACIA SAO JOSE & CIA", "acentos removidos no alfanumérico");

// 3) Matriz de validação (clientes nomeados do Documento Mestre)
const cod = (id: string) => avaliarCliente(clientes.find((c) => c.id === id)!, "09/2026").map((a) => a.codigo);
check(cod("C000001").includes("CNPJ_INVALIDO"), "Drogaria Horizonte: CNPJ incompatível (BLOCKER)");
check(cod("C000002").includes("AGING_MISMATCH"), "Farmácia Boa Vida: aging inconsistente (BLOCKER)");
check(cod("C000003").includes("EXPOSICAO_ACIMA_LIMITE"), "VetPrime: exposição acima do limite (DECISION)");
check(cod("C000004").includes("VENCIDOS_ACIMA_90"), "Cosmetika: vencidos acima de 90 dias (DECISION)");
check(cod("C000005").includes("LIMITE_PROXIMO") && !cod("C000005").includes("EXPOSICAO_ACIMA_LIMITE"), "Drogaria Central: limite próximo (WARNING), sem exposição");
check(cod("C000006").includes("SEM_MOVIMENTACAO"), "Saúde & Cia: sem movimentação (INFO)");
const acoes = validarRemessa(clientes, "T-1", "09/2026", new Date().toISOString());
const res = resumoValidacao(clientes.map((c) => c.id), [], acoes);
check(res.bloqueados >= 3 && res.bloqueados < 40, `remessa de 400: ${res.bloqueados} bloqueados, ${res.comAlerta} com alerta, ${res.aprovadosAuto} aprovados (prontidão ${res.prontidao}%)`);
check(res.aprovadosAuto + res.comAlerta + res.bloqueados === 400, "contadores fecham com o total");

// 4) Workflow: bloqueio da aprovação até resolver os BLOCKER
const e0 = estadoInicial();
const rem = e0.remessas[0];
check(rem.status === "ACTION_REQUIRED" && rem.bloqueados > 0, `estado inicial: remessa ${rem.id} em ACTION_REQUIRED com ${rem.bloqueados} bloqueio(s), ${e0.acoes.length} ações`);
check(!podeAprovar(e0, rem.id).ok, "não pode aprovar com bloqueios pendentes");
check(aprovarRemessa(e0, rem.id, "teste").erro !== undefined, "aprovarRemessa recusa com bloqueios");
let e = e0;
for (const a of e0.acoes.filter((x) => x.remessaId === rem.id && x.tipo === "BLOCKER")) {
  const decisao = a.codigo === "AGING_MISMATCH" ? "ACEITAR_ORIGEM" : "EXCLUIR_DA_REMESSA";
  e = resolverAcao(e, a.id, decisao, "Teste automatizado", {}, "teste");
}
const r1 = e.remessas.find((x) => x.id === rem.id)!;
check(r1.bloqueados === 0 && r1.status === "READY_FOR_APPROVAL", `após resolver os bloqueios: ${r1.status}, ${r1.excluidos.length} excluído(s)`);
check(e.acoes.filter((a) => a.remessaId === rem.id && a.status === "RESOLVED").every((a) => a.justificativa && a.resolvidaPor), "toda ação resolvida guarda justificativa e usuário");
const boaVida = e.clientes.find((c) => c.id === "C000002")!;
check(boaVida.vencidos.d01 + boaVida.vencidos.d11 + boaVida.vencidos.d31 + boaVida.vencidos.d91 + boaVida.vencidos.d181 + boaVida.vencidos.d361 === boaVida.debitoVencido, "Aceitar origem fecha as faixas com o débito vencido");
check(gerarArquivoRemessa(e, rem.id, "teste").erro !== undefined, "não gera arquivo antes da aprovação");
const ap = aprovarRemessa(e, rem.id, "teste");
check(!ap.erro && ap.estado.remessas[0].status === "APPROVED", "aprovação registrada (APPROVED)");
const ge = gerarArquivoRemessa(ap.estado, rem.id, "teste");
const linhasArq = (ge.conteudo ?? "").split("\r\n").filter(Boolean);
check(!ge.erro && ge.estado.remessas[0].status === "GENERATED" && ge.estado.remessas[0].arquivo?.registros === linhasArq.length, `INFASSOC.SIC gerado: ${linhasArq.length} registros`);
check(linhasArq.every((l) => l.length === 270 && validarLinha(l).length === 0), "todas as linhas do arquivo têm 270 posições e passam nas regras");
check(linhasArq.length === rem.registros - ge.estado.remessas[0].excluidos.length, "registros do arquivo = recebidos menos excluídos");
check(!linhasArq.some((l) => l.slice(6, 14) === "12345678"), "cliente excluído (CNPJ inválido) não vai no arquivo");
const en = enviarRemessa(ge.estado, rem.id, "teste");
check(!en.erro && en.estado.remessas[0].status === "SENT" && !!en.estado.remessas[0].protocolo, "envio registra SENT com protocolo");
check(en.estado.auditoria.some((a) => a.acao === "Arquivo gerado") && en.estado.auditoria.some((a) => a.acao === "Envio aprovado"), "auditoria tem geração e aprovação");
const nova = receberRemessa(en.estado, "ERP", "teste");
check(nova.remessa.id === "2026-09-003" && nova.estado.remessas[0].status !== "SENT", "nova remessa do ERP recebe o próximo id e reentra no fluxo");

// 4b) Processo simples: três situações e um botão só para enviar
check(statusSimples(e0.remessas[0]) === "Em preparação", "situação simples: Em preparação enquanto houver travados");
check(enviarTudo(e0, rem.id, "teste").erro !== undefined, "enviarTudo recusa com clientes travados");
check(statusSimples(e.remessas.find((x) => x.id === rem.id)!) === "Pronta", "situação simples: Pronta sem travados");
const tudo = enviarTudo(e, rem.id, "teste");
const rTudo = tudo.estado.remessas.find((x) => x.id === rem.id)!;
check(!tudo.erro && rTudo.status === "SENT" && statusSimples(rTudo) === "Enviada" && !!rTudo.protocolo, "enviarTudo aprova, gera e envia em um passo (Enviada, com protocolo)");
check((tudo.conteudo ?? "").split("\r\n").filter(Boolean).every((l) => l.length === 270), "arquivo do envio em um passo tem 270 posições por linha");
check(["Envio aprovado", "Arquivo gerado", "Envio à Credinfar"].every((a) => tudo.estado.auditoria.some((x) => x.acao === a)), "histórico registra aprovação, geração e envio");

// 5) API Credinfar simulada: IP, token, quota, XML, anonimização, D-1
const p = parametrosIniciais();
const ok = consultarCredinfar("27100900", p, clientes, 0);
check(ok.resultado === "OK" && ok.httpStatus === 200 && ok.xml.startsWith("<?xml"), "consulta OK devolve XML");
check(ok.xml.includes("<dbCredinfar>") && ok.xml.includes("</dbCredinfar>") && ok.xml.includes("<riskRating>") && ok.xml.includes("<informacoes>"), "XML com a raiz dbCredinfar, riskRating e informacoes");
const blocos = ["acoes", "administradores", "alertas", "balancoAnalise", "balancoComentario", "balancoConceito", "balancoDemonsFluxoCaixa", "balancoIndicesPadraoAno", "balancos", "balancosIndices", "cadastroJuridico", "cheques", "dadosCadastro", "debitoConsolidados", "falencias", "grupoEconomico", "historicoPerformances", "inadimplencia", "informacaoComplementar", "informacoes", "outrasEmpresasAdministradas", "protestos", "qsas", "riskRating", "simples", "sintegra"];
check(blocos.every((b) => new RegExp(`<${b}[ >/]`).test(ok.xml)), "os 26 blocos do manual aparecem no XML");
check((ok.xml.match(/<informacao>/g) ?? []).length <= LIMITE_FONTES_NEGOCIAIS, "informações negociais limitadas a 10 fontes");
check(!/Abbott|abbott|codAssociada|<fonte>/.test(ok.xml), "XML não identifica a associada (fontes anonimizadas)");
check(ok.ficha!.fontes.every((f) => /^Fonte \d\d$/.test(f.fonte)), "fontes rotuladas apenas como Fonte NN");
const ontem = new Date();
ontem.setDate(ontem.getDate() - 1);
check(ok.ficha!.dataBase === `${String(ontem.getDate()).padStart(2, "0")}/${String(ontem.getMonth() + 1).padStart(2, "0")}/${ontem.getFullYear()}`, "base de dados em D-1");
const ok2 = consultarCredinfar("27100900", p, clientes, 0);
check(ok2.xml === ok.xml, "consulta determinística (VIEW congelada)");
check(ok.ficha!.balancos.length === 0 || ok.ficha!.balancos.length === 3, `balanços: ${ok.ficha!.balancos.length} períodos (0 ou 3)`);
const ip = consultarCredinfar("27100900", { ...p, ipSaida: "177.10.20.30" }, clientes, 0);
check(ip.resultado === "IP_NAO_AUTORIZADO" && ip.httpStatus === 403 && ip.xml.includes("<ipOrigem>177.10.20.30</ipOrigem>"), "IP não cadastrado: erro em XML com o IP de origem");
check(limiteQuota(p) === 4473, "quota = 1,5x 2.982 = 4.473");
const q = consultarCredinfar("27100900", p, clientes, 4473);
check(q.resultado === "LIMITE_EXCEDIDO" && q.httpStatus === 429, "quota esgotada suspende o acesso");
const tk = consultarCredinfar("27100900", { ...p, token: "" }, clientes, 0);
check(tk.resultado === "TOKEN_INVALIDO" && tk.httpStatus === 401, "sem token: 401");
const fora = consultarCredinfar("61412110", p, clientes, 0);
check(fora.resultado === "OK" || fora.resultado === "SEM_DADOS", `CNPJ fora da carteira responde (${fora.resultado})`);
const lei = avaliar(clientes.find((c) => c.id === "C000004")!, ok.ficha!);
check(lei.titulo.length > 0 && lei.porque.length > 0 && ["verde", "amarelo", "vermelho"].includes(lei.cor), `leitura em linguagem simples: "${lei.titulo}"`);
const eq = consultar(e0, "27100900", "teste");
check(eq.estado.consultas.length === e0.consultas.length + 1 && eq.consulta.resultado === "OK" && eq.estado.auditoria[0].acao === "Consulta Credinfar", "consulta pelo estado registra histórico, quota e auditoria");

// 6) Do dado à decisão: leitura da carteira, sinais e registro da decisão
const eS = estadoInicial();
const porTipo = (t: string) => eS.sinais.filter((x) => x.tipo === t).length;
check(eS.sinais.length > 0 && eS.varredura !== null, `leitura inicial: ${eS.sinais.length} decisões (${porTipo("RISCO")} risco, ${porTipo("COBRANCA")} cobrança, ${porTipo("OPORTUNIDADE")} oportunidade), ${eS.varredura?.consultados} clientes consultados`);
check(eS.parametros.consultasNoMes + RESERVA_CONSULTAS <= limiteQuota(eS.parametros), "a leitura respeita o limite do mês e guarda a reserva do dia a dia");
check(eS.sinais.every((x) => x.porque.length > 0 && x.opcoes.length > 0 && x.titulo.length > 0), "todo cartão tem motivo e pelo menos uma ação");
const semCota = lerCarteira(eS.clientes, { ...eS.parametros, consultasNoMes: limiteQuota(eS.parametros) }, limiteQuota(eS.parametros));
check(semCota.consultados === 0 && semCota.semQuota > 0, "sem consultas disponíveis, a leitura não gasta nada e avisa quem ficou de fora");
const ipRuim = lerCarteira(eS.clientes.slice(0, 5), { ...eS.parametros, ipSaida: "1.2.3.4" }, 0);
check(ipRuim.erro !== undefined, "IP não cadastrado interrompe a leitura com mensagem clara");
const alvo = eS.sinais.find((x) => x.opcoes.some((o) => o.acao === "AJUSTAR_LIMITE" && o.novoLimite))!;
const opLim = alvo.opcoes.find((o) => o.acao === "AJUSTAR_LIMITE")!;
const eD = registrarDecisao(eS, alvo.clienteId, opLim, {}, "teste");
check(eD.clientes.find((c) => c.id === alvo.clienteId)!.limite === opLim.novoLimite, `decisão aplica o novo limite (${opLim.rotulo})`);
check(eD.sinais.find((x) => x.id === alvo.id)!.status === "DECIDIDO" && eD.auditoria[0].acao === "Decisão de crédito", "cartão sai da lista e a decisão fica no histórico");
const eR = atualizarCarteira(eD, "teste");
check(!eR.erro && !eR.estado.sinais.some((x) => x.id === alvo.id && x.status === "ABERTO"), "nova leitura não reabre o que já foi decidido");
const cob = eS.sinais.find((x) => x.tipo === "COBRANCA");
if (cob) {
  const eC = registrarDecisao(eS, cob.clienteId, cob.opcoes[0], { nota: "Falei com o financeiro", promessaEm: "2026-09-25" }, "teste");
  check(eC.auditoria[0].acao === "Cobrança registrada" && eC.auditoria[0].detalhe.includes("25/09/2026"), "cobrança registra o contato e a promessa de pagamento");
}
const gr = eS.sinais.find((x) => x.opcoes.some((o) => o.acao === "BLOQUEAR_VENDAS"));
if (gr) {
  const eB = registrarDecisao(eS, gr.clienteId, gr.opcoes.find((o) => o.acao === "BLOQUEAR_VENDAS")!, {}, "teste");
  check(eB.clientes.find((c) => c.id === gr.clienteId)!.bloqueado === true, "segurar vendas marca o cliente");
}

// 7) Análises da carteira
const an = analisar(eS);
check(eS.varredura!.leituras.length === eS.varredura!.consultados, "varredura guarda uma leitura compacta por cliente consultado");
check(an.tendencia.length === 12 && an.tendencia[11].enviados === eS.clientes.length, "histórico de 12 meses termina na competência corrente");
check(Math.abs(an.porNota.reduce((t, x) => t + x.pct, 0) - 100) < 0.5 && an.porNota.length === NOTAS.length, "carteira por nota fecha em 100%");
check(an.migracao.matriz.flat().reduce((t, x) => t + x, 0) === eS.varredura!.leituras.length && an.migracao.pioraram > 0, `migração de notas: ${an.migracao.pioraram} pioraram, ${an.migracao.melhoraram} melhoraram`);
check(an.quadrantes.pontos.length > 100 && an.quadrantes.resumo.some((r) => r.grupo === "Atrasa só com a gente" && r.clientes > 0), "quadrantes com a gente x mercado povoados");
check(an.concentracao.itens.length === 10 && an.concentracao.pctTop > 0 && an.concentracao.clientesPara80 > 10, `concentração: top 10 = ${an.concentracao.pctTop.toFixed(1)}%, ${an.concentracao.clientesPara80} clientes fazem 80%`);
// O aging soma as faixas de cada cliente; a única diferença para o vencido total é a
// Farmácia Boa Vida, cujas faixas foram deixadas propositalmente inconsistentes (caso AGING_MISMATCH do envio).
const somaAging = an.aging.reduce((t, f) => t + f.valor, 0);
const desvioAging = eS.clientes.filter((c) => c.debitoAtual > 0).reduce((t, c) => t + (c.debitoVencido - Object.values(c.vencidos).reduce((a, b) => a + b, 0)), 0);
check(somaAging + desvioAging === an.kpis.vencido && desvioAging > 0 && desvioAging < an.kpis.vencido * 0.01, `aging fecha com o vencido total (só o caso inconsistente de propósito fica de fora: R$ ${desvioAging})`);
const anD = analisar(eD);
check(anD.efeito.limiteReduzido > 0 || anD.efeito.limiteAumentado > 0, "efeito das decisões lê os limites alterados");

console.log(falhas === 0 ? "\nMotor: todos os cenários passaram." : `\nMotor: ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
