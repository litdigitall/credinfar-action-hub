// Hoje: a tela inicial é uma lista curta de decisões, já priorizada por
// dinheiro em jogo. Vem da leitura mensal da carteira na Credinfar cruzada com
// a posição do cliente conosco. Uma decisão por cartão, um clique para agir.
import { useMemo, useState } from "react";
import { IconArrowRight, IconChartBar, IconCoin, IconListCheck, IconRefresh, IconSearch } from "@tabler/icons-react";
import { useHub } from "../App";
import { Botao } from "../components/Botao";
import { CartaoDecisao, COR_TIPO, ModalDecisao, ROTULO_TIPO } from "../components/Decidir";
import { fmtDataHora, fmtInt } from "../components/visual";
import { brlInt } from "../engine/util";
import { statusSimples } from "../services/estado";
import type { OpcaoAcao, Sinal, TipoSinal } from "../models/types";
import { tema } from "../theme/tema";

const PRIMEIROS = 5;

export function Hoje() {
  const { estado, usuario, metricas: m, remessaAtual, decidir, atualizarLeitura, verCliente, setAba } = useHub();
  const [filtro, setFiltro] = useState<TipoSinal | "TODOS">("TODOS");
  const [todos, setTodos] = useState(false);
  const [emDecisao, setEmDecisao] = useState<{ sinal: Sinal; opcao: OpcaoAcao } | null>(null);

  const clientes = useMemo(() => new Map(estado.clientes.map((c) => [c.id, c])), [estado.clientes]);
  const abertos = useMemo(() => estado.sinais.filter((s) => s.status === "ABERTO"), [estado.sinais]);
  const lista = useMemo(() => (filtro === "TODOS" ? [...abertos].sort((a, b) => b.valorEmJogo - a.valorEmJogo) : abertos.filter((s) => s.tipo === filtro)), [abertos, filtro]);
  // Na visão "Tudo", as 5 primeiras misturam os três tipos (2 de risco, 2 de
  // cobrança, 1 de venda), sempre as de maior valor de cada um.
  const equilibradas = useMemo(() => {
    const maiores = (t: TipoSinal, n: number) => abertos.filter((s) => s.tipo === t).sort((a, b) => b.valorEmJogo - a.valorEmJogo).slice(0, n);
    const escolha = [...maiores("RISCO", 2), ...maiores("COBRANCA", 2), ...maiores("OPORTUNIDADE", 1)];
    const faltam = PRIMEIROS - escolha.length;
    const resto = faltam > 0 ? [...abertos].sort((a, b) => b.valorEmJogo - a.valorEmJogo).filter((s) => !escolha.includes(s)).slice(0, faltam) : [];
    return [...escolha, ...resto];
  }, [abertos]);
  const visiveis = todos ? lista.slice(0, 60) : filtro === "TODOS" ? equilibradas : lista.slice(0, PRIMEIROS);
  const decididas = estado.sinais.filter((s) => s.status === "DECIDIDO").sort((a, b) => (b.decisao?.em ?? "").localeCompare(a.decisao?.em ?? "")).slice(0, 3);
  const conta = (t: TipoSinal) => abertos.filter((s) => s.tipo === t).length;
  const emJogo = lista.reduce((t, s) => t + s.valorEmJogo, 0);
  const emJogoTotal = abertos.reduce((t, s) => t + s.valorEmJogo, 0);
  const primeiroNome = usuario.split(" ")[0];
  const situacaoEnvio = remessaAtual ? statusSimples(remessaAtual) : null;
  const restantes = Math.max(0, m.quotaLimite - m.quotaUsada);
  const quotaPct = m.quotaLimite > 0 ? (m.quotaUsada / m.quotaLimite) * 100 : 0;
  const v = estado.varredura;
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      {/* ------------------------------------------------ Cabeçalho */}
      <div className="anim-subir" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 6 }}>{hoje}</div>
          <h1 className="h1">Olá, {primeiroNome}.</h1>
          <p className="lead">
            {abertos.length === 0 ? "Nenhuma decisão pendente. A carteira está em dia." : lista.length > PRIMEIROS ? `Comece por estas ${PRIMEIROS}. São as de maior valor entre as ${fmtInt(abertos.length)} que a carteira pede neste mês.` : `${fmtInt(lista.length)} decisão(ões) esperam por você.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Botao variante="secundario" icone={<IconChartBar size={16} />} onClick={() => setAba("analises")}>
            Análises da carteira
          </Botao>
          <Botao variante="secundario" icone={<IconRefresh size={16} />} onClick={atualizarLeitura}>
            Atualizar com a Credinfar
          </Botao>
        </div>
      </div>

      {/* ------------------------------------------------ Números do mês */}
      <div className="gridTiles anim-lista" style={{ marginBottom: 18 }}>
        <Tile icone={<IconCoin size={20} />} cor={tema.blue} rotulo="Em jogo nas decisões" valor={brlInt(emJogoTotal)} sub={`${fmtInt(abertos.length)} decisões abertas`} />
        <Tile icone={<IconListCheck size={20} />} cor={tema.grape} rotulo="Por tipo" valor={`${conta("RISCO")} · ${conta("COBRANCA")} · ${conta("OPORTUNIDADE")}`} sub="risco · cobrança · vender mais" />
        <Tile icone={<IconSearch size={20} />} cor={quotaPct >= 85 ? tema.amber : tema.ok} rotulo="Consultas restantes no mês" valor={fmtInt(restantes)} sub={`de ${fmtInt(m.quotaLimite)} (1,5 por cliente enviado)`} barra={quotaPct} />
        {remessaAtual && situacaoEnvio !== "Enviada" ? (
          <button onClick={() => setAba("envio")} className="card card-hover" style={{ textAlign: "left", cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start", borderColor: m.bloqueios > 0 ? "rgba(224,49,49,0.35)" : tema.line }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: m.bloqueios > 0 ? tema.dangerBg : tema.okBg, color: m.bloqueios > 0 ? tema.danger : tema.ok, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <IconArrowRight size={20} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, color: tema.muted, fontWeight: 600 }}>Envio de {remessaAtual.competencia}</span>
              <span className="display" style={{ display: "block", fontSize: 19, fontWeight: 600, color: m.bloqueios > 0 ? tema.danger : tema.ok, letterSpacing: "-0.01em", marginTop: 2 }}>{m.bloqueios > 0 ? `${m.bloqueios} travado(s)` : "Pronto para sair"}</span>
              <span style={{ display: "block", fontSize: 12, color: tema.blue, fontWeight: 700, marginTop: 3 }}>{m.bloqueios > 0 ? "Resolver agora ›" : "Enviar ›"}</span>
            </span>
          </button>
        ) : (
          <Tile icone={<IconArrowRight size={20} />} cor={tema.ok} rotulo={`Envio de ${estado.parametros.competencia}`} valor="Enviado" sub={remessaAtual?.protocolo ? `protocolo ${remessaAtual.protocolo}` : ""} />
        )}
      </div>

      {/* ------------------------------------------------ Filtros */}
      <div className="anim-subir" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Pilula ativa={filtro === "TODOS"} onClick={() => { setFiltro("TODOS"); setTodos(false); }} rotulo="Tudo" n={abertos.length} />
        {(["RISCO", "COBRANCA", "OPORTUNIDADE"] as TipoSinal[]).map((t) => (
          <Pilula key={t} ativa={filtro === t} onClick={() => { setFiltro(t); setTodos(false); }} rotulo={ROTULO_TIPO[t]} n={conta(t)} cor={COR_TIPO[t][0]} />
        ))}
        {lista.length > 0 && filtro !== "TODOS" && <span className="num" style={{ marginLeft: "auto", fontSize: 13, color: tema.muted }}>{brlInt(emJogo)} em jogo nesta lista</span>}
      </div>

      {/* ------------------------------------------------ Decisões */}
      <div className="anim-lista" style={{ display: "flex", flexDirection: "column", gap: 12 }} key={`${filtro}-${todos}`}>
        {visiveis.length === 0 && (
          <div className="card" style={{ color: tema.ok, fontSize: 15, padding: 28, textAlign: "center", fontWeight: 600 }}>
            Tudo em dia por aqui. Quando a próxima leitura da Credinfar trouxer novidade, ela aparece nesta tela.
          </div>
        )}
        {visiveis.map((s) => (
          <CartaoDecisao
            key={s.id}
            nome={clientes.get(s.clienteId)?.nome ?? s.clienteId}
            tipo={s.tipo}
            cor={s.cor}
            titulo={s.titulo}
            porque={s.porque}
            valorEmJogo={s.valorEmJogo}
            opcoes={s.opcoes}
            onAbrirCliente={() => verCliente(s.clienteId)}
            onEscolher={(o) => setEmDecisao({ sinal: s, opcao: o })}
          />
        ))}
      </div>
      {lista.length > visiveis.length && (
        <div style={{ marginTop: 14 }}>
          <Botao variante="secundario" onClick={() => setTodos(true)}>Ver as outras {fmtInt(Math.min(60, lista.length) - visiveis.length)} desta lista</Botao>
        </div>
      )}

      {/* ------------------------------------------------ Últimas decisões */}
      {decididas.length > 0 && (
        <div className="card anim-subir" style={{ marginTop: 24 }}>
          <div className="kicker">Últimas decisões</div>
          {decididas.map((s) => (
            <div key={s.id} style={{ fontSize: 13.5, padding: "9px 0", borderTop: `1px solid ${tema.line}`, marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <b style={{ color: tema.heading }}>{clientes.get(s.clienteId)?.nome ?? s.clienteId}</b>
              <span style={{ color: tema.ink }}>{s.decisao?.detalhe}</span>
              <span style={{ color: tema.muted, marginLeft: "auto", fontSize: 12.5 }}>{s.decisao?.usuario} · {fmtDataHora(s.decisao?.em ?? "")}</span>
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            <Botao variante="link" tamanho="pequeno" onClick={() => setAba("historico")}>Ver o histórico completo</Botao>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Rodapé da leitura */}
      <div style={{ marginTop: 22, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 13, color: tema.muted }}>
        <span>{v ? `Última leitura da Credinfar: ${fmtDataHora(v.em)}, ${fmtInt(v.consultados)} clientes (dados de ontem).` : "A carteira ainda não foi lida na Credinfar."}</span>
      </div>
      {v && (
        <details className="card" style={{ marginTop: 12 }}>
          <summary style={{ fontWeight: 700, color: tema.blueDark }}>Retrato da carteira por nota da Credinfar</summary>
          <Retrato porNota={v.porNota} />
        </details>
      )}

      {emDecisao && clientes.get(emDecisao.sinal.clienteId) && (
        <ModalDecisao
          cliente={clientes.get(emDecisao.sinal.clienteId)!}
          opcao={emDecisao.opcao}
          onFechar={() => setEmDecisao(null)}
          onConfirmar={(extras) => {
            decidir(emDecisao.sinal.clienteId, emDecisao.opcao, extras);
            setEmDecisao(null);
          }}
        />
      )}
    </>
  );
}

function Tile({ icone, cor, rotulo, valor, sub, barra }: { icone: React.ReactNode; cor: string; rotulo: string; valor: string; sub?: string; barra?: number }) {
  return (
    <div className="card card-hover" style={{ display: "flex", gap: 14, alignItems: "flex-start", minWidth: 0 }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, background: `${cor}14`, color: cor, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-hidden="true">
        {icone}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, color: tema.muted, fontWeight: 600 }}>{rotulo}</div>
        <div className="display num" style={{ fontSize: 22, fontWeight: 600, color: tema.heading, letterSpacing: "-0.01em", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={valor}>{valor}</div>
        {sub && <div style={{ fontSize: 12, color: tema.muted, marginTop: 3 }}>{sub}</div>}
        {barra !== undefined && (
          <div className="barra" style={{ marginTop: 8 }} aria-hidden="true">
            <i style={{ width: `${Math.min(100, barra)}%`, background: barra >= 85 ? tema.amber : undefined }} />
          </div>
        )}
      </div>
    </div>
  );
}

function Pilula({ rotulo, n, ativa, onClick, cor }: { rotulo: string; n: number; ativa: boolean; onClick: () => void; cor?: string }) {
  return (
    <button className="pill" onClick={onClick} aria-pressed={ativa}>
      {cor && !ativa && <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor }} aria-hidden="true" />}
      {rotulo} <span className="n">{fmtInt(n)}</span>
    </button>
  );
}

function Retrato({ porNota }: { porNota: Record<string, { clientes: number; debito: number }> }) {
  const total = Object.values(porNota).reduce((t, x) => t + x.debito, 0) || 1;
  const cores: Record<string, string> = { A: "#2E4AED", B: "#96A3F5", C: "#A8BABA", D: "#FF9EAD", E: "#FF2652" };
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", height: 14, borderRadius: 8, overflow: "hidden", gap: 2 }} aria-hidden="true">
        {Object.entries(porNota).map(([nota, x]) => (
          <div key={nota} title={`Nota ${nota}`} style={{ width: `${(x.debito / total) * 100}%`, background: cores[nota] }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12, fontSize: 13 }}>
        {Object.entries(porNota).map(([nota, x]) => (
          <span key={nota}>
            <b style={{ color: cores[nota] }}>Nota {nota}</b> · {Math.round((x.debito / total) * 100)}% do débito · {fmtInt(x.clientes)} clientes · {brlInt(x.debito)}
          </span>
        ))}
      </div>
    </div>
  );
}
