// Análises da carteira: o que a leitura mensal da Credinfar, cruzada com a
// posição conosco, diz sobre risco, cobrança e oportunidade. Cada gráfico
// responde a uma pergunta de negócio e tem a leitura escrita logo abaixo.
import { useMemo } from "react";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { IconArrowDownRight, IconArrowUpRight, IconPhoneCall, IconShieldCheck, IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { useHub } from "../App";
import { Botao } from "../components/Botao";
import { Section, brlExec, fmtDataHora, fmtInt } from "../components/visual";
import { analisar, CORTE_MERCADO, CORTE_NOSSO, NOTAS } from "../engine/analises";
import type { Quadrante } from "../engine/analises";
import { brlInt } from "../engine/util";
import { tema } from "../theme/tema";

// Paleta dos gráficos (validada com o verificador de paletas): categórica
// azul · laranja, sempre com legenda e rótulo direto; notas A–E em escala
// divergente azul (bom) · cinza · vermelho (ruim), sempre com a letra escrita;
// magnitude em um só matiz (azul, claro → escuro).
const COR = { s1: "#007ACC", s2: "#E8590C", grid: "#E4EAF2", eixo: "#94A3B8", texto: "#64748B", cinza: "#C7CFD9" };
const COR_NOTA: Record<string, string> = { A: "#256ABF", B: "#86B6EF", C: "#B8BEC6", D: "#F0A0A0", E: "#E34948" };
const SIGNIFICADO: Record<string, string> = { A: "excelente", B: "boa", C: "aceitável", D: "fraca", E: "insuficiente" };
const GRUPOS: Quadrante[] = ["Atrasa com todo o mercado", "Atrasa só com a gente", "Em dia ou atraso leve"];
const COR_GRUPO: Record<Quadrante, string> = { "Atrasa com todo o mercado": COR.s2, "Atrasa só com a gente": COR.s1, "Em dia ou atraso leve": COR.cinza };
const SEQ = ["#CDE2FB", "#9EC5F4", "#6DA7EC", "#3987E5", "#256ABF", "#1C5CAB", "#104281"];

const mil = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : `${Math.round(v / 1000).toLocaleString("pt-BR")} mil`);
const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const pct0 = (v: number) => `${Math.round(v).toLocaleString("pt-BR")}%`;
const dinheiro = (v: number) => (v === 0 ? "R$ 0" : brlExec(v));
const TICK = { fontSize: 11, fill: COR.texto };
const CURSOR_BARRA = { fill: "rgba(0,122,204,0.06)" };

export function Analises() {
  const { estado, setAba, verCliente } = useHub();
  const a = useMemo(() => analisar(estado), [estado]);
  const k = a.kpis;
  const v = estado.varredura;
  const porNome = useMemo(() => new Map(estado.clientes.map((c) => [c.nome, c.id])), [estado.clientes]);
  const abrirPorNome = (p: { nome?: string } | undefined) => {
    const id = p?.nome ? porNome.get(p.nome) : undefined;
    if (id) verCliente(id);
  };

  const meses = useMemo(() => a.tendencia.map((p) => ({ ...p, emDia: p.debito - p.vencido })), [a.tendencia]);
  const ufs = useMemo(() => a.porUf.map((u) => ({ ...u, emDia: u.debito - u.vencido })), [a.porUf]);
  const ultimo = a.tendencia[a.tendencia.length - 1];
  const primeiro = a.tendencia[0];
  const mediaPct = a.tendencia.reduce((t, p) => t + p.pctVencido, 0) / Math.max(1, a.tendencia.length);
  const crescimento = primeiro?.debito ? ((ultimo.debito - primeiro.debito) / primeiro.debito) * 100 : 0;
  const antigos = a.aging.filter((f) => f.antiga).reduce((t, f) => t + f.valor, 0);
  const totalMigra = a.migracao.matriz.flat().reduce((t, x) => t + x, 0) || 1;
  const maxCel = Math.max(1, ...a.migracao.matriz.flatMap((l, i) => l.filter((_, j) => i !== j)));
  const notasAB = a.porNota[0].pct + a.porNota[1].pct;

  return (
    <>
      <div className="anim-subir" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 6 }}>Leitura de {v ? fmtDataHora(v.em) : "..."} · {fmtInt(v?.consultados ?? 0)} clientes consultados na Credinfar</div>
          <h1 className="h1">Análises da carteira</h1>
          <p className="lead">O que o mercado diz dos nossos clientes, cruzado com o que eles devem para a gente. Cada gráfico responde a uma pergunta.</p>
        </div>
        <Botao variante="secundario" onClick={() => setAba("hoje")}>Ir para as decisões</Botao>
      </div>

      {/* ------------------------------------------------ KPIs */}
      <div className="gridTiles anim-lista" style={{ marginBottom: 22 }}>
        <Kpi rotulo="Exposição total" valor={brlExec(k.exposicao)} sub={`${fmtInt(k.clientesAtivos)} clientes com débito`} />
        <Kpi rotulo="Vencido" valor={brlExec(k.vencido)} sub={`${pct1(k.pctVencido)} da carteira`} delta={k.variacaoVencido} deltaSufixo=" p.p. no mês" pior="sobe" />
        <Kpi rotulo="Em clientes nota D ou E" valor={brlExec(k.emNotasDE)} sub={`${pct1(k.pctNotasDE)} da exposição`} cor={k.pctNotasDE > 10 ? tema.danger : tema.heading} />
        <Kpi rotulo="Prazo médio de recebimento" valor={`${k.dso} dias`} sub={primeiro ? `${primeiro.dso} dias há 12 meses` : ""} />
        <Kpi rotulo="Decisões abertas" valor={fmtInt(k.decisoesAbertas)} sub={`${brlExec(k.valorDecisoes)} em jogo`} cor={tema.blue} />
      </div>

      {/* ------------------------------------------------ Tendência */}
      <div className="gridDuo anim-lista" style={{ marginBottom: 22 }}>
        <Grafico titulo="Vencido como % da carteira, 12 meses" pergunta="A inadimplência está subindo ou caindo?" leitura={`${pct1(ultimo.pctVencido)} hoje contra ${pct1(primeiro.pctVencido)} há um ano. Média do período: ${pct1(mediaPct)}.`}>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={a.tendencia} margin={{ top: 16, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={COR.grid} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: COR.texto }} interval={0} axisLine={{ stroke: COR.grid }} tickLine={false} padding={{ left: 16, right: 16 }} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} width={40} tickFormatter={(x) => pct0(Number(x))} domain={[(min: number) => Math.floor(min - 0.6), (max: number) => Math.ceil(max + 0.6)]} allowDecimals={false} />
              <ReferenceLine y={Math.round(mediaPct * 10) / 10} stroke={COR.eixo} label={{ value: "média do ano", position: "insideBottomRight", fontSize: 10, fill: COR.texto }} />
              <Tooltip content={<Dica formato={(x) => pct1(Number(x))} />} cursor={{ stroke: COR.eixo, strokeWidth: 1 }} />
              <Line type="monotone" dataKey="pctVencido" name="Vencido" stroke={COR.s1} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: "#fff", fill: COR.s1 }} activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false}>
                <LabelList dataKey="pctVencido" content={<RotuloExtremos dados={a.tendencia} />} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </Grafico>
        <Grafico titulo="Débito e vencido por mês" pergunta="A carteira cresceu junto com o atraso?" leitura={`Débito ${mil(ultimo.debito)} hoje, ${crescimento >= 0 ? "+" : ""}${pct0(crescimento)} em 12 meses. Vencido ${mil(ultimo.vencido)}, ${pct1(ultimo.pctVencido)} do total.`} legenda={[["Em dia", COR.s1], ["Vencido", COR.s2]]}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={meses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke={COR.grid} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: COR.texto }} interval={0} axisLine={{ stroke: COR.grid }} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} width={58} tickFormatter={(x) => mil(Number(x))} />
              <Tooltip content={<Dica formato={(x) => brlInt(Number(x))} />} cursor={CURSOR_BARRA} />
              <Bar dataKey="emDia" name="Em dia" stackId="carteira" fill={COR.s1} stroke="#fff" strokeWidth={1} isAnimationActive={false} />
              <Bar dataKey="vencido" name="Vencido" stackId="carteira" fill={COR.s2} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </div>

      {/* ------------------------------------------------ Nota e aging */}
      <div className="gridDuo anim-lista" style={{ marginBottom: 22 }}>
        <Grafico titulo="Carteira por nota da Credinfar" pergunta="Quanto do nosso dinheiro está com quem o mercado avalia mal?" leitura={`${pct0(notasAB)} do débito está em clientes nota A ou B; ${pct1(k.pctNotasDE)} em D ou E.`}>
          <div style={{ display: "flex", height: 34, borderRadius: 9, overflow: "hidden", gap: 2, margin: "6px 0 12px" }} aria-hidden="true">
            {a.porNota.map((n) => (
              <div key={n.nota} title={`Nota ${n.nota}: ${pct1(n.pct)}`} style={{ width: `${n.pct}%`, background: COR_NOTA[n.nota], display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: n.nota === "A" || n.nota === "E" ? "#fff" : tema.heading, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden" }}>
                {n.pct >= 5 ? n.nota : ""}
                {n.pct >= 12 && <span style={{ fontWeight: 600, opacity: 0.85 }}>{pct0(n.pct)}</span>}
              </div>
            ))}
          </div>
          <table className="tabela compacta">
            <thead>
              <tr>
                <th>Nota</th>
                <th style={{ textAlign: "right" }}>Clientes</th>
                <th style={{ textAlign: "right" }}>Débito</th>
                <th style={{ textAlign: "right" }}>% carteira</th>
                <th style={{ textAlign: "right" }}>Vencido</th>
              </tr>
            </thead>
            <tbody>
              {a.porNota.map((n) => (
                <tr key={n.nota}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 11, height: 11, borderRadius: 3, background: COR_NOTA[n.nota], flexShrink: 0 }} aria-hidden="true" />
                      <b>{n.nota}</b> <span style={{ color: tema.muted }}>{SIGNIFICADO[n.nota]}</span>
                    </span>
                  </td>
                  <td className="num" style={{ textAlign: "right" }}>{fmtInt(n.clientes)}</td>
                  <td className="num" style={{ textAlign: "right" }}>{dinheiro(n.debito)}</td>
                  <td className="num" style={{ textAlign: "right" }}>{pct1(n.pct)}</td>
                  <td className="num" style={{ textAlign: "right", color: n.debito > 0 && n.vencido / n.debito > 0.15 ? tema.danger : tema.ink, fontWeight: n.debito > 0 && n.vencido / n.debito > 0.15 ? 700 : 500 }}>{dinheiro(n.vencido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Grafico>
        <Grafico titulo="Aging do vencido" pergunta="O atraso é recente ou já envelheceu?" leitura={`${brlExec(antigos)} vencidos há mais de 90 dias (${pct0((antigos / Math.max(1, k.vencido)) * 100)} do vencido). Quanto mais velho o atraso, mais difícil receber.`} legenda={[["Até 90 dias", COR.s1], ["Mais de 90 dias", COR.s2]]}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={a.aging} margin={{ top: 22, right: 8, left: 0, bottom: 16 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke={COR.grid} />
              <XAxis dataKey="faixa" tick={TICK} axisLine={{ stroke: COR.grid }} tickLine={false} label={{ value: "dias de atraso", position: "insideBottom", offset: -12, fontSize: 10.5, fill: COR.texto }} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} width={50} tickFormatter={(x) => mil(Number(x))} />
              <Tooltip content={<Dica formato={(x) => brlInt(Number(x))} />} cursor={CURSOR_BARRA} />
              <Bar dataKey="valor" name="Vencido" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {a.aging.map((f) => (
                  <Cell key={f.faixa} fill={f.antiga ? COR.s2 : COR.s1} />
                ))}
                <LabelList dataKey="valor" content={<RotuloTopo formato={mil} />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </div>

      {/* ------------------------------------------------ Quadrantes e migração */}
      <div className="gridDuo anim-lista" style={{ marginBottom: 22 }}>
        <Grafico titulo="Com a gente x no mercado" pergunta="Quem atrasa com todo mundo e quem atrasa só conosco?" leitura={a.quadrantes.resumo.map((r) => `${r.grupo}: ${fmtInt(r.clientes)} clientes, ${brlExec(r.vencido)} vencidos`).join(". ") + "."} legenda={GRUPOS.map((g) => [g, COR_GRUPO[g]])}>
          <ResponsiveContainer width="100%" height={290}>
            <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
              <CartesianGrid stroke={COR.grid} />
              <XAxis type="number" dataKey="x" name="Vencido no mercado" domain={[0, 60]} tick={TICK} axisLine={{ stroke: COR.grid }} tickLine={false} tickFormatter={(x) => (Number(x) === 0 ? "" : pct0(Number(x)))} label={{ value: "% vencido no mercado", position: "insideBottom", offset: -6, fontSize: 10.5, fill: COR.texto }} />
              <YAxis type="number" dataKey="y" name="Vencido conosco" domain={[0, 50]} tick={TICK} axisLine={false} tickLine={false} width={58} tickFormatter={(x) => pct0(Number(x))} label={{ value: "% vencido conosco", angle: -90, position: "insideLeft", offset: 6, fontSize: 10.5, fill: COR.texto }} />
              <ZAxis type="number" dataKey="z" range={[30, 420]} name="Débito conosco" />
              <ReferenceLine x={CORTE_MERCADO} stroke={COR.eixo} />
              <ReferenceLine y={CORTE_NOSSO} stroke={COR.eixo} />
              <Tooltip content={<DicaPonto />} cursor={{ stroke: COR.eixo }} />
              {[...GRUPOS].reverse().map((g) => (
                <Scatter key={g} name={g} data={a.quadrantes.pontos.filter((p) => p.grupo === g)} fill={COR_GRUPO[g]} fillOpacity={g === "Em dia ou atraso leve" ? 0.45 : 0.85} stroke="#fff" strokeWidth={1.5} onClick={abrirPorNome} style={{ cursor: "pointer" }} isAnimationActive={false} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 12, color: tema.muted, marginTop: 4 }}>Tamanho do ponto = débito conosco. Linhas de corte: {CORTE_MERCADO}% no mercado e {CORTE_NOSSO}% conosco. Clique num ponto para abrir o cliente.</div>
        </Grafico>
        <Grafico titulo="Migração de notas no mês" pergunta="Quem piorou antes de atrasar com a gente?" leitura={`${fmtInt(a.migracao.pioraram)} clientes pioraram de nota (${brlExec(a.migracao.valorPiorou)} de débito conosco) e ${fmtInt(a.migracao.melhoraram)} melhoraram (${brlExec(a.migracao.valorMelhorou)}).`}>
          <table className="tabela compacta">
            <thead>
              <tr>
                <th>Mês passado ↓ · hoje →</th>
                {NOTAS.map((n) => <th key={n} style={{ textAlign: "center" }}>{n}</th>)}
              </tr>
            </thead>
            <tbody>
              {a.migracao.matriz.map((linha, i) => (
                <tr key={NOTAS[i]}>
                  <td><b>Nota {NOTAS[i]}</b></td>
                  {linha.map((n, j) => {
                    const diag = i === j;
                    const forca = diag ? 0 : Math.min(6, Math.round((n / maxCel) * 6));
                    return (
                      <td key={j} className="num" title={`${fmtInt(n)} clientes: ${NOTAS[i]} → ${NOTAS[j]} (${pct1((n / totalMigra) * 100)})`} style={{ textAlign: "center", background: diag ? tema.surface2 : n > 0 ? SEQ[forca] : tema.surface, color: forca >= 4 ? "#fff" : diag ? tema.muted : tema.heading, fontWeight: diag ? 500 : 700, padding: "12px 6px" }}>
                        {n > 0 ? fmtInt(n) : ""}
                        {!diag && n > 0 && (j > i ? <IconArrowDownRight size={11} style={{ marginLeft: 3, verticalAlign: -1 }} aria-label="piorou" /> : <IconArrowUpRight size={11} style={{ marginLeft: 3, verticalAlign: -1 }} aria-label="melhorou" />)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: tema.muted, marginTop: 8 }}>Linha = nota no mês passado, coluna = nota hoje. Diagonal = quem não mudou. Quanto mais escura a célula, mais clientes.</div>
        </Grafico>
      </div>

      {/* ------------------------------------------------ Concentração e UF */}
      <div className="gridDuo anim-lista" style={{ marginBottom: 22 }}>
        <Grafico titulo="Concentração: os 10 maiores devedores" pergunta="Quantos clientes carregam a carteira?" leitura={`Os 10 maiores somam ${pct1(a.concentracao.pctTop)} do débito. ${fmtInt(a.concentracao.clientesPara80)} clientes (de ${fmtInt(k.clientesAtivos)}) fazem 80% da carteira: exposição bem distribuída.`}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={a.concentracao.itens} layout="vertical" margin={{ top: 4, right: 64, left: 8, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid horizontal={false} stroke={COR.grid} />
              <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} tickFormatter={(x) => mil(Number(x))} />
              <YAxis type="category" dataKey="nome" width={168} tick={{ fontSize: 10.5, fill: tema.ink }} axisLine={false} tickLine={false} tickFormatter={(n: string) => (n.length > 26 ? `${n.slice(0, 25)}…` : n)} />
              <Tooltip content={<DicaConcentracao />} cursor={CURSOR_BARRA} />
              <Bar dataKey="debito" name="Débito" fill={COR.s1} radius={[0, 4, 4, 0]} onClick={abrirPorNome} style={{ cursor: "pointer" }} isAnimationActive={false}>
                <LabelList dataKey="debito" content={<RotuloDireita formato={mil} />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
        <Grafico titulo="Débito por estado" pergunta="Onde está a exposição?" leitura={`${a.porUf[0]?.uf ?? ""} concentra ${a.porUf[0] ? pct0((a.porUf[0].debito / Math.max(1, k.exposicao)) * 100) : "0%"} do débito${a.porUf[0] ? ` com ${fmtInt(a.porUf[0].clientes)} clientes` : ""}.`} legenda={[["Em dia", COR.s1], ["Vencido", COR.s2]]}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={ufs} layout="vertical" margin={{ top: 4, right: 64, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid horizontal={false} stroke={COR.grid} />
              <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} tickFormatter={(x) => mil(Number(x))} />
              <YAxis type="category" dataKey="uf" width={36} tick={{ fontSize: 12, fill: tema.ink, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <Tooltip content={<Dica formato={(x) => brlInt(Number(x))} />} cursor={CURSOR_BARRA} />
              <Bar dataKey="emDia" name="Em dia" stackId="uf" fill={COR.s1} stroke="#fff" strokeWidth={1} isAnimationActive={false} />
              <Bar dataKey="vencido" name="Vencido" stackId="uf" fill={COR.s2} stroke="#fff" strokeWidth={1} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList dataKey="debito" content={<RotuloDireita formato={mil} />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Grafico>
      </div>

      {/* ------------------------------------------------ Efeito das decisões */}
      <Section titulo="Efeito das decisões deste mês" sub="O que as decisões tomadas no app já mudaram na carteira.">
        <div className="gridTiles anim-lista">
          <Kpi rotulo="Limite retirado de clientes em risco" valor={dinheiro(a.efeito.limiteReduzido)} sub="exposição futura evitada" cor={tema.danger} icone={<IconTrendingDown size={18} />} />
          <Kpi rotulo="Limite dado a bons pagadores" valor={dinheiro(a.efeito.limiteAumentado)} sub="venda liberada" cor={tema.ok} icone={<IconTrendingUp size={18} />} />
          <Kpi rotulo="Vendas seguradas ou com garantia" valor={dinheiro(a.efeito.bloqueados + a.efeito.garantias)} sub="débito protegido" icone={<IconShieldCheck size={18} />} />
          <Kpi rotulo="Cobranças registradas" valor={fmtInt(a.efeito.cobrancas)} sub={`${dinheiro(a.efeito.valorCobrado)} vencidos em negociação`} icone={<IconPhoneCall size={18} />} />
        </div>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
function Grafico({ titulo, pergunta, leitura, legenda, children }: { titulo: string; pergunta: string; leitura: string; legenda?: [string, string][]; children: ReactNode }) {
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div className="kicker">{pergunta}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: tema.heading, letterSpacing: "-0.01em", marginTop: 3 }}>{titulo}</div>
        </div>
        {legenda && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: tema.muted }}>
            {legenda.map(([r, c]) => (
              <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} aria-hidden="true" /> {r}
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
      <div style={{ fontSize: 13, color: tema.ink, lineHeight: 1.55, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${tema.line}` }}>
        <b>Leitura:</b> {leitura}
      </div>
    </div>
  );
}

function Kpi({ rotulo, valor, sub, cor, icone, delta, deltaSufixo, pior }: { rotulo: string; valor: string; sub?: string; cor?: string; icone?: ReactNode; delta?: number; deltaSufixo?: string; pior?: "sobe" | "desce" }) {
  const ruim = delta !== undefined && (pior === "sobe" ? delta > 0 : delta < 0);
  return (
    <div className="card card-hover" style={{ minWidth: 0, display: "flex", gap: 12 }}>
      {icone && <span style={{ width: 36, height: 36, borderRadius: 11, background: `${cor ?? tema.blue}14`, color: cor ?? tema.blue, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icone}</span>}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: tema.muted, fontWeight: 600 }}>{rotulo}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: cor ?? tema.heading, letterSpacing: "-0.02em", marginTop: 2, whiteSpace: "nowrap" }}>{valor}</div>
        <div style={{ fontSize: 12, color: tema.muted, marginTop: 3, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {delta !== undefined && Math.abs(delta) >= 0.05 && (
            <span style={{ color: ruim ? tema.danger : tema.ok, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}>
              {delta > 0 ? <IconArrowUpRight size={13} /> : <IconArrowDownRight size={13} />}
              {delta > 0 ? "+" : ""}
              {delta.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              {deltaSufixo}
            </span>
          )}
          {sub && <span>{sub}</span>}
        </div>
      </div>
    </div>
  );
}

// Dica (tooltip) padrão: nome da série + valor formatado
const DICA_ESTILO = { background: "#0B1A2C", color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, boxShadow: "0 8px 24px rgba(11,26,44,0.25)" } as const;

function Dica({ active, payload, label, formato }: { active?: boolean; payload?: { name?: string; value?: number | string; color?: string }[]; label?: string; formato: (x: number | string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={DICA_ESTILO}>
      {label !== undefined && <div style={{ fontWeight: 800, marginBottom: 4 }}>{String(label)}</div>}
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color ?? "#fff" }} aria-hidden="true" />
          <span style={{ opacity: 0.85 }}>{p.name}</span>
          <b style={{ marginLeft: "auto" }}>{formato(p.value ?? 0)}</b>
        </div>
      ))}
    </div>
  );
}

function DicaPonto({ active, payload }: { active?: boolean; payload?: { payload?: { nome: string; x: number; y: number; z: number; grupo: string; nota: string } }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div style={{ ...DICA_ESTILO, maxWidth: 260 }}>
      <div style={{ fontWeight: 800 }}>{p.nome}</div>
      <div style={{ opacity: 0.85, marginTop: 3 }}>Nota {p.nota} · {p.grupo}</div>
      <div style={{ marginTop: 4 }}>Vencido conosco <b>{pct1(p.y)}</b> · no mercado <b>{pct1(p.x)}</b></div>
      <div>Deve para a gente <b>{brlInt(p.z)}</b></div>
    </div>
  );
}

function DicaConcentracao({ active, payload }: { active?: boolean; payload?: { payload?: { nome: string; debito: number; pct: number; pctAcumulado: number } }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div style={{ ...DICA_ESTILO, maxWidth: 280 }}>
      <div style={{ fontWeight: 800 }}>{p.nome}</div>
      <div style={{ marginTop: 4 }}>Deve <b>{brlInt(p.debito)}</b> ({pct1(p.pct)} da carteira)</div>
      <div style={{ opacity: 0.85 }}>Acumulado até aqui: {pct1(p.pctAcumulado)}</div>
    </div>
  );
}

// Rótulos diretos desenhados à mão (o rótulo padrão quebra "7,1 mi" em duas linhas)
type PropsRotulo = { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | string; formato: (v: number) => string };
function RotuloTopo({ x, y, width, value, formato }: PropsRotulo) {
  if (value === undefined) return null;
  return (
    <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={COR.texto}>
      {formato(Number(value))}
    </text>
  );
}
function RotuloDireita({ x, y, width, height, value, formato }: PropsRotulo) {
  if (value === undefined) return null;
  return (
    <text x={Number(x) + Number(width) + 6} y={Number(y) + Number(height) / 2} dominantBaseline="central" fontSize={10.5} fontWeight={600} fill={COR.texto}>
      {formato(Number(value))}
    </text>
  );
}

// Na linha, rótulo só no primeiro, no último e no maior ponto, nunca em todos
function RotuloExtremos(p: { x?: number | string; y?: number | string; index?: number; dados: { pctVencido: number }[] }) {
  const i = p.index ?? -1;
  const n = p.dados.length;
  const maior = p.dados.reduce((m, d, k) => (d.pctVencido > p.dados[m].pctVencido ? k : m), 0);
  if (i !== 0 && i !== n - 1 && i !== maior) return null;
  const v = p.dados[i]?.pctVencido;
  if (v === undefined) return null;
  return (
    <text x={Number(p.x)} y={Number(p.y) - 9} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={COR.texto}>
      {pct1(v)}
    </text>
  );
}
