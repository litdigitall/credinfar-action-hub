// Hoje: a tela inicial é uma lista curta de decisões, já priorizada por
// dinheiro em jogo. Vem da leitura mensal da carteira na Credinfar cruzada com
// a posição do cliente conosco. Uma decisão por cartão, um clique para agir.
import { useMemo, useState } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { useHub } from "../App";
import { Botao } from "../components/Botao";
import { CartaoDecisao, COR_TIPO, ModalDecisao, ROTULO_TIPO } from "../components/Decidir";
import { fmtDataHora, fmtInt } from "../components/visual";
import { brlInt } from "../engine/util";
import { statusSimples } from "../services/estado";
import type { OpcaoAcao, Sinal, TipoSinal } from "../models/types";
import { cardStyle, kickerStyle, tema } from "../theme/tema";

const PRIMEIROS = 5;

export function Hoje() {
  const { estado, usuario, metricas: m, remessaAtual, decidir, atualizarLeitura, verCliente, setAba } = useHub();
  const [filtro, setFiltro] = useState<TipoSinal | "TODOS">("TODOS");
  const [todos, setTodos] = useState(false);
  const [emDecisao, setEmDecisao] = useState<{ sinal: Sinal; opcao: OpcaoAcao } | null>(null);

  const clientes = useMemo(() => new Map(estado.clientes.map((c) => [c.id, c])), [estado.clientes]);
  const abertos = useMemo(() => estado.sinais.filter((s) => s.status === "ABERTO"), [estado.sinais]);
  const lista = useMemo(() => {
    const base = filtro === "TODOS" ? [...abertos].sort((a, b) => b.valorEmJogo - a.valorEmJogo) : abertos.filter((s) => s.tipo === filtro);
    return base;
  }, [abertos, filtro]);
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
  const primeiroNome = usuario.split(" ")[0];
  const situacaoEnvio = remessaAtual ? statusSimples(remessaAtual) : null;
  const quotaPct = m.quotaLimite > 0 ? (m.quotaUsada / m.quotaLimite) * 100 : 0;
  const v = estado.varredura;

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: tema.heading, letterSpacing: "-0.5px" }}>Olá, {primeiroNome}.</div>
        <div style={{ fontSize: 15, color: tema.muted, marginTop: 4 }}>
          {abertos.length === 0 ? "Nenhuma decisão pendente. A carteira está em dia." : lista.length > PRIMEIROS ? `Comece por estas ${PRIMEIROS}. São as de maior valor entre as ${fmtInt(abertos.length)} que a carteira pede neste mês.` : `${fmtInt(lista.length)} decisão(ões) esperam por você.`}
        </div>
      </div>

      {/* Lembretes: só aparecem quando há o que fazer */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {remessaAtual && situacaoEnvio !== "Enviada" && (
          <button onClick={() => setAba("envio")} style={lembrete}>
            <b>Envio de {remessaAtual.competencia}:</b> {m.bloqueios > 0 ? `${m.bloqueios} cliente(s) travado(s)` : "pronto para sair"} <span style={{ color: tema.blue, fontWeight: 700 }}>{m.bloqueios > 0 ? "Resolver" : "Enviar"} ›</span>
          </button>
        )}
        {quotaPct >= 85 && (
          <span style={{ ...lembrete, cursor: "default", borderColor: tema.amber }}>
            <b>Consultas do mês quase no fim:</b> {fmtInt(m.quotaUsada)} de {fmtInt(m.quotaLimite)}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Pilula ativa={filtro === "TODOS"} onClick={() => { setFiltro("TODOS"); setTodos(false); }} rotulo="Tudo" n={abertos.length} />
        {(["RISCO", "COBRANCA", "OPORTUNIDADE"] as TipoSinal[]).map((t) => (
          <Pilula key={t} ativa={filtro === t} onClick={() => { setFiltro(t); setTodos(false); }} rotulo={ROTULO_TIPO[t]} n={conta(t)} cor={COR_TIPO[t][0]} />
        ))}
        {lista.length > 0 && <span style={{ marginLeft: "auto", fontSize: 13, color: tema.muted }}>{brlInt(emJogo)} em jogo nesta lista</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visiveis.length === 0 && (
          <div style={{ ...cardStyle, color: tema.ok, fontSize: 15, padding: 24, textAlign: "center" }}>
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
        <div style={{ marginTop: 12 }}>
          <Botao variante="link" onClick={() => setTodos(true)}>Ver as outras {fmtInt(Math.min(60, lista.length) - visiveis.length)} desta lista</Botao>
        </div>
      )}

      {decididas.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 22 }}>
          <div style={kickerStyle}>Últimas decisões</div>
          {decididas.map((s) => (
            <div key={s.id} style={{ fontSize: 13.5, padding: "7px 0", borderTop: `1px solid ${tema.line}`, marginTop: 7, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <b style={{ color: tema.heading }}>{clientes.get(s.clienteId)?.nome ?? s.clienteId}</b>
              <span style={{ color: tema.ink }}>{s.decisao?.detalhe}</span>
              <span style={{ color: tema.muted, marginLeft: "auto" }}>{s.decisao?.usuario} · {fmtDataHora(s.decisao?.em ?? "")}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 22, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 13, color: tema.muted }}>
        <span>{v ? `Última leitura da Credinfar: ${fmtDataHora(v.em)}, ${fmtInt(v.consultados)} clientes (dados de ontem).` : "A carteira ainda não foi lida na Credinfar."}</span>
        <Botao variante="secundario" tamanho="pequeno" icone={<IconRefresh size={15} />} onClick={atualizarLeitura}>Atualizar com a Credinfar</Botao>
      </div>

      {v && (
        <details style={{ ...cardStyle, marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, color: tema.blueDark }}>Retrato da carteira por nota da Credinfar</summary>
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

function Pilula({ rotulo, n, ativa, onClick, cor }: { rotulo: string; n: number; ativa: boolean; onClick: () => void; cor?: string }) {
  return (
    <button onClick={onClick} aria-pressed={ativa} style={{ border: `1px solid ${ativa ? tema.blue : tema.line}`, background: ativa ? tema.blueSoft : tema.surface, borderRadius: 999, padding: "8px 16px", cursor: "pointer", fontSize: 14, fontWeight: ativa ? 700 : 500, color: tema.heading }}>
      {rotulo} <span style={{ color: cor ?? tema.muted, fontWeight: 800 }}>{fmtInt(n)}</span>
    </button>
  );
}

function Retrato({ porNota }: { porNota: Record<string, { clientes: number; debito: number }> }) {
  const total = Object.values(porNota).reduce((t, x) => t + x.debito, 0) || 1;
  const cores: Record<string, string> = { A: tema.ok, B: "#74B816", C: tema.amber, D: "#E8590C", E: tema.danger };
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden" }} aria-hidden="true">
        {Object.entries(porNota).map(([nota, x]) => (
          <div key={nota} title={`Nota ${nota}`} style={{ width: `${(x.debito / total) * 100}%`, background: cores[nota] }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 13 }}>
        {Object.entries(porNota).map(([nota, x]) => (
          <span key={nota}>
            <b style={{ color: cores[nota] }}>Nota {nota}</b> · {Math.round((x.debito / total) * 100)}% do débito · {fmtInt(x.clientes)} clientes · {brlInt(x.debito)}
          </span>
        ))}
      </div>
    </div>
  );
}

const lembrete = { border: `1px solid ${tema.line}`, background: tema.surface, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, color: tema.ink, cursor: "pointer", textAlign: "left" as const };
