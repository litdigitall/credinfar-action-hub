// Clientes: busca, a posição conosco, a decisão que a leitura mensal já pede
// (sem gastar consulta) e, a pedido, a ficha atual da Credinfar com a
// comparação "com a gente x no mercado" e as ações no mesmo lugar.
import { useEffect, useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { useHub } from "../App";
import { Botao } from "../components/Botao";
import { CartaoDecisao, ModalDecisao } from "../components/Decidir";
import { DetalhesFicha } from "../components/Ficha";
import { Aviso, Chip, inputStyle } from "../components/ui";
import { Section, fmtInt } from "../components/visual";
import type { FichaResumo, RespostaCredinfar } from "../engine/credinfarMock";
import { limiteQuota } from "../engine/credinfarMock";
import { avaliar, SIGNIFICADO_NOTA } from "../engine/sinais";
import { brlInt, formatarCnpj, raizCnpj, soDigitos } from "../engine/util";
import { consultasNoCiclo } from "../services/estado";
import type { Cliente, OpcaoAcao } from "../models/types";
import { SEGMENTOS } from "../models/types";
import { cardStyle, corRisco, kickerStyle, tema } from "../theme/tema";

const ERRO_SIMPLES: Record<string, string> = {
  IP_NAO_AUTORIZADO: "A Credinfar recusou a consulta: o endereço de internet (IP) de saída não é o cadastrado. Avise a TI.",
  LIMITE_EXCEDIDO: "O limite mensal de consultas foi atingido. As consultas voltam no próximo mês.",
  TOKEN_INVALIDO: "A Credinfar recusou a consulta: a chave de acesso está ausente ou inválida. Avise a TI.",
  SEM_DADOS: "A Credinfar não tem informação para este CNPJ.",
};

export function Clientes() {
  const { estado, clienteFoco, focarCliente, consultarCredinfar, decidir, liberar } = useHub();
  const [busca, setBusca] = useState("");
  const [raizAvulsa, setRaizAvulsa] = useState<string | null>(null);
  const [resposta, setResposta] = useState<RespostaCredinfar | null>(null);
  const [emDecisao, setEmDecisao] = useState<OpcaoAcao | null>(null);

  useEffect(() => {
    if (!clienteFoco) return;
    setRaizAvulsa(null);
    setResposta(null);
  }, [clienteFoco]);

  const b = busca.trim().toLowerCase();
  const digitos = soDigitos(b);
  const resultados = useMemo(() => (b.length < 3 ? [] : estado.clientes.filter((c) => c.nome.toLowerCase().includes(b) || (digitos.length >= 4 && c.cnpj.includes(digitos))).slice(0, 8)), [estado.clientes, b, digitos]);
  const cliente: Cliente | null = clienteFoco ? (estado.clientes.find((c) => c.id === clienteFoco) ?? null) : null;
  const sinal = cliente ? estado.sinais.find((s) => s.clienteId === cliente.id && s.status === "ABERTO") : undefined;
  const ultimaDecisao = cliente ? estado.sinais.filter((s) => s.clienteId === cliente.id && s.status === "DECIDIDO").sort((x, y) => (y.decisao?.em ?? "").localeCompare(x.decisao?.em ?? ""))[0] : undefined;
  const atencao = useMemo(() => estado.sinais.filter((s) => s.status === "ABERTO").slice(0, 8), [estado.sinais]);
  const podeForaDaCarteira = digitos.length === 8 && resultados.length === 0;
  const usadas = consultasNoCiclo(estado);
  const limite = limiteQuota(estado.parametros);

  const escolher = (id: string) => {
    focarCliente(id);
    setRaizAvulsa(null);
    setResposta(null);
    setBusca("");
  };

  return (
    <>
      <div style={{ ...cardStyle, marginBottom: 18 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconSearch size={18} color={tema.muted} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do cliente ou CNPJ" aria-label="Buscar cliente" style={{ ...inputStyle, fontSize: 15, padding: "11px 14px" }} autoFocus />
        </span>
        {resultados.map((c) => (
          <button key={c.id} onClick={() => escolher(c.id)} style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 10, padding: "10px", border: "none", borderBottom: `1px solid ${tema.line}`, background: "none", cursor: "pointer", textAlign: "left", fontSize: 13.5 }}>
            <span style={{ fontWeight: 700, color: tema.heading }}>{c.nome}</span>
            <span style={{ color: tema.muted, fontFamily: tema.mono, fontSize: 12.5 }}>{formatarCnpj(c.cnpj)} · {c.cidade}/{c.uf}</span>
          </button>
        ))}
        {podeForaDaCarteira && (
          <div style={{ marginTop: 10 }}>
            <Botao variante="secundario" tamanho="pequeno" onClick={() => { focarCliente(null); setRaizAvulsa(digitos); setResposta(consultarCredinfar(digitos)); }}>
              Consultar o CNPJ {digitos} (não é nosso cliente)
            </Botao>
          </div>
        )}
        {b.length >= 3 && resultados.length === 0 && !podeForaDaCarteira && <div style={{ marginTop: 8, fontSize: 13, color: tema.muted }}>Nenhum cliente encontrado. Para uma empresa que não é cliente, digite os 8 primeiros dígitos do CNPJ.</div>}
        {!cliente && !raizAvulsa && b.length < 3 && atencao.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={kickerStyle}>Pedem decisão agora</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {atencao.map((s) => {
                const c = estado.clientes.find((x) => x.id === s.clienteId);
                return (
                  <button key={s.id} onClick={() => escolher(s.clienteId)} style={{ border: `1px solid ${tema.line}`, background: tema.surface, borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontSize: 13, color: tema.heading }}>
                    {c?.nome.split(" ").slice(0, 3).join(" ")}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {cliente && (
        <Section titulo={cliente.nome} sub={`${formatarCnpj(cliente.cnpj)} · ${cliente.cidade}/${cliente.uf} · ${SEGMENTOS[cliente.segmento]} · ${cliente.canal}`}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <Chip texto={`Risco interno ${cliente.risco}`} fg={corRisco[cliente.risco].fg} bg={corRisco[cliente.risco].bg} />
            {cliente.bloqueado && <Chip texto="Vendas a prazo seguradas" fg={tema.danger} bg={tema.dangerBg} />}
            {cliente.condicao && <Chip texto={cliente.condicao} fg={tema.amber} bg={tema.amberBg} />}
            {(cliente.bloqueado || cliente.condicao) && <Botao variante="link" tamanho="pequeno" onClick={() => liberar(cliente.id)}>Liberar vendas normais</Botao>}
          </div>
          <div style={{ ...cardStyle, display: "flex", gap: 28, flexWrap: "wrap" }}>
            <Numero rotulo="Limite" valor={brlInt(cliente.limite)} />
            <Numero rotulo="Deve para a gente" valor={brlInt(cliente.debitoAtual)} sub={cliente.limite > 0 ? `${Math.round((cliente.debitoAtual / cliente.limite) * 100)}% do limite` : ""} cor={cliente.debitoAtual > cliente.limite ? tema.danger : undefined} />
            <Numero rotulo="Vencido" valor={brlInt(cliente.debitoVencido)} sub={cliente.diasAtraso ? `${cliente.diasAtraso} dias de atraso médio` : "em dia"} cor={cliente.debitoVencido > 0 ? tema.amber : tema.ok} />
          </div>

          {sinal && !resposta && (
            <div style={{ marginTop: 12 }}>
              <div style={{ ...kickerStyle, marginBottom: 6 }}>Da leitura mensal da Credinfar (nota {sinal.nota})</div>
              <CartaoDecisao tipo={sinal.tipo} cor={sinal.cor} titulo={sinal.titulo} porque={sinal.porque} valorEmJogo={sinal.valorEmJogo} opcoes={sinal.opcoes} onEscolher={setEmDecisao} />
            </div>
          )}
          {!sinal && ultimaDecisao && !resposta && (
            <Aviso tipo="info">Última decisão: {ultimaDecisao.decisao?.detalhe} ({ultimaDecisao.decisao?.usuario}).</Aviso>
          )}

          {!resposta && (
            <div style={{ ...cardStyle, marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13.5, color: tema.ink }}>
                <b>Quer ver a ficha de hoje?</b> Mostra como ele paga os outros fornecedores. Gasta 1 das {fmtInt(Math.max(0, limite - usadas))} consultas que restam no mês.
              </div>
              <Botao onClick={() => setResposta(consultarCredinfar(raizCnpj(cliente.cnpj)))}>Consultar a Credinfar agora</Botao>
            </div>
          )}
        </Section>
      )}

      {resposta && !resposta.ficha && (
        <Section titulo="Resposta da Credinfar">
          <Aviso tipo={resposta.resultado === "SEM_DADOS" ? "aviso" : "erro"}>{ERRO_SIMPLES[resposta.resultado] ?? "A consulta não pôde ser feita."}</Aviso>
        </Section>
      )}
      {resposta?.ficha && <FichaDecisao f={resposta.ficha} resposta={resposta} cliente={cliente} onEscolher={setEmDecisao} />}

      {emDecisao && cliente && (
        <ModalDecisao
          cliente={cliente}
          opcao={emDecisao}
          onFechar={() => setEmDecisao(null)}
          onConfirmar={(extras) => {
            decidir(cliente.id, emDecisao, extras);
            setEmDecisao(null);
          }}
        />
      )}
    </>
  );
}

function Numero({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div style={{ minWidth: 150 }}>
      <div style={{ fontSize: 12.5, color: tema.muted }}>{rotulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: cor ?? tema.heading }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: tema.muted }}>{sub}</div>}
    </div>
  );
}

// Ficha de hoje: leitura com as ações, comparação com o mercado e tendência.
function FichaDecisao({ f, resposta, cliente, onEscolher }: { f: FichaResumo; resposta: RespostaCredinfar; cliente: Cliente | null; onEscolher: (o: OpcaoAcao) => void }) {
  const l = avaliar(cliente, f);
  const pctNosso = cliente && cliente.debitoAtual > 0 ? (cliente.debitoVencido / cliente.debitoAtual) * 100 : 0;
  const maior = Math.max(1, ...f.serieMeses.map((m) => (m.debito > 0 ? (m.vencido / m.debito) * 100 : 0)));
  const corTend = f.tendencia === "piorando" ? tema.danger : f.tendencia === "melhorando" ? tema.ok : tema.muted;
  const bal = f.balancos[f.balancos.length - 1];
  return (
    <Section titulo={cliente ? "O que o mercado diz hoje" : `O que o mercado diz · ${f.nome}`} sub={`Nota ${f.avaliacao} (${SIGNIFICADO_NOTA[f.avaliacao] ?? ""}) na Credinfar${f.avaliacaoAnterior !== f.avaliacao ? `, era ${f.avaliacaoAnterior} no mês passado` : ""} · dados de ${f.dataBase}`}>
      <CartaoDecisao tipo={l.tipo} cor={l.cor} titulo={l.titulo} porque={l.porque} valorEmJogo={l.valorEmJogo} opcoes={l.opcoes} onEscolher={onEscolher} />

      <div className="gridDuo" style={{ marginTop: 12 }}>
        <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ color: tema.muted, textAlign: "right" }}>
                <th style={{ ...th, textAlign: "left" }}></th>
                <th style={th}>Com a gente</th>
                <th style={th}>No mercado</th>
              </tr>
            </thead>
            <tbody>
              <Linha rotulo="Deve" a={cliente ? brlInt(cliente.debitoAtual) : ""} b={brlInt(f.debitoAtualRede)} />
              <Linha rotulo="Vencido" a={cliente ? `${brlInt(cliente.debitoVencido)} (${pctNosso.toFixed(0)}%)` : ""} b={`${brlInt(f.debitoVencidoRede)} (${f.percentualVencido.toFixed(0)}%)`} alerta={f.percentualVencido > 20} />
              <Linha rotulo="Atraso médio" a={cliente ? `${cliente.diasAtraso} dias` : ""} b={`${f.atrasoMedioMercado} dias`} />
              <Linha rotulo="Limite" a={cliente ? brlInt(cliente.limite) : ""} b={f.limiteMedioMercado ? `${brlInt(f.limiteMedioMercado)} em média` : "não informado"} />
              <Linha rotulo="Fornecedores" a="" b={`${f.totalFontes} informando`} />
            </tbody>
          </table>
        </div>
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={kickerStyle}>Vencido no mercado, 12 meses</div>
            <b style={{ color: corTend, fontSize: 13 }}>{f.tendencia}</b>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 70, marginTop: 10 }} aria-hidden="true">
            {f.serieMeses.map((m) => {
              const p = m.debito > 0 ? (m.vencido / m.debito) * 100 : 0;
              return <div key={m.mes} title={`${m.mes}: ${p.toFixed(1)}%`} style={{ flex: 1, height: `${Math.max(4, (p / maior) * 100)}%`, background: p > 20 ? tema.danger : p > 8 ? tema.amber : tema.ok, borderRadius: 3 }} />;
            })}
          </div>
          <div style={{ fontSize: 12.5, color: tema.muted, marginTop: 8, lineHeight: 1.6 }}>
            {f.naListaPerformance ? "Está na lista de atenção da Credinfar. " : ""}
            {bal ? `Balanço de ${bal.dataBalanco}: conceito ${bal.conceitoGlobal}, liquidez ${bal.liqCorrente.toLocaleString("pt-BR")}.` : "Sem balanço na Credinfar."}
          </div>
        </div>
      </div>

      <details style={{ ...cardStyle, marginTop: 12 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, color: tema.blueDark }}>Ver detalhes</summary>
        <div style={{ marginTop: 12 }}>
          <DetalhesFicha resposta={resposta} />
        </div>
      </details>
    </Section>
  );
}

function Linha({ rotulo, a, b, alerta }: { rotulo: string; a: string; b: string; alerta?: boolean }) {
  return (
    <tr>
      <td style={{ ...td, color: tema.muted }}>{rotulo}</td>
      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{a}</td>
      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: alerta ? tema.danger : tema.heading }}>{b}</td>
    </tr>
  );
}

const th = { padding: "10px 14px", fontWeight: 600, borderBottom: `1px solid ${tema.line}` } as const;
const td = { padding: "10px 14px", borderBottom: `1px solid ${tema.line}` } as const;
