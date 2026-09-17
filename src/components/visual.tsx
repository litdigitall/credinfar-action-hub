// Linguagem visual do Contábil Hub (idêntica ao app principal): Section,
// MetricCard, anel de conciliação, linhas de barra e tabela simples.
import type { CSSProperties, ReactNode } from "react";
import { brl, cardStyle, kickerStyle, tema } from "../theme/tema";

export const fmtInt = (v: number) => v.toLocaleString("pt-BR");
export const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export const fmtData = (iso: string) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString("pt-BR") : "");
export const fmtDataHora = (iso: string) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleString("pt-BR") : "");

export function Section({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: tema.heading, margin: "0 0 12px" }}>{titulo}</h2>
      {sub && <div style={{ fontSize: 12.5, color: tema.muted, margin: "-6px 0 12px" }}>{sub}</div>}
      {children}
    </section>
  );
}

// Card de KPI — mesmo componente do app principal.
export function MetricCard({ label, valor, cor, sub }: { label: string; valor: string; cor?: string; sub?: string }) {
  return (
    <div style={{ ...cardStyle, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, color: tema.muted, marginBottom: 6 }}>{label}</div>
      <div
        style={{ fontSize: "clamp(17px, 1.6vw, 22px)", fontWeight: 700, color: cor ?? tema.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        title={valor}
      >
        {valor}
      </div>
      {sub && <div style={{ fontSize: 12, color: tema.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// Anel de conciliação (conic-gradient) — igual ao Dashboard do app principal.
export function Anel({ pct, ok, pendentes, rotuloOk = "ok", rotuloPend = "pendentes", rotuloCentro = "sucesso" }: { pct: number; ok: number; pendentes: number; rotuloOk?: string; rotuloPend?: string; rotuloCentro?: string }) {
  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 20 }}>
      <div style={{ width: 168, height: 168, borderRadius: "50%", background: `conic-gradient(${tema.ok} ${pct * 3.6}deg, ${tema.dangerBg} 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 128, height: 128, borderRadius: "50%", background: tema.surface, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: tema.heading, lineHeight: 1 }}>{pct.toLocaleString("pt-BR", { maximumFractionDigits: pct === Math.round(pct) ? 0 : 1 })}%</div>
          <div style={{ fontSize: 11.5, color: tema.muted, marginTop: 4 }}>{rotuloCentro}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 12.5 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: tema.ok }} />
          <b style={{ color: tema.heading }}>{fmtInt(ok)}</b>
          <span style={{ color: tema.muted }}>{rotuloOk}</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: tema.danger }} />
          <b style={{ color: tema.heading }}>{fmtInt(pendentes)}</b>
          <span style={{ color: tema.muted }}>{rotuloPend}</span>
        </span>
      </div>
    </div>
  );
}

// Linha de barra horizontal — mesmo markup do Dashboard do app principal.
export interface Linha {
  rotulo: string;
  valor: number; // define o comprimento
  texto: string; // valor formatado à direita
  cor?: string;
  extra?: string; // coluna curta entre o rótulo e a barra (ex.: "3×")
  alerta?: boolean;
}
export function Barras({ linhas, larguraRotulo = 70, larguraTexto = 130, cor = tema.danger, vazio = "Nenhuma pendência." }: { linhas: Linha[]; larguraRotulo?: number; larguraTexto?: number; cor?: string; vazio?: string }) {
  if (linhas.length === 0) return <div style={{ ...cardStyle, color: tema.ok, fontSize: 13.5 }}>{vazio}</div>;
  const maior = Math.max(...linhas.map((l) => Math.abs(l.valor)), 1);
  return (
    <div style={cardStyle}>
      {linhas.map((l) => (
        <div key={l.rotulo} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
          <span style={{ width: larguraRotulo, fontSize: 13, color: tema.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={l.rotulo}>{l.rotulo}</span>
          {l.extra !== undefined && <span style={{ width: 34, fontSize: 12.5, color: tema.muted }}>{l.extra}</span>}
          <div style={{ flex: 1, background: tema.bg, borderRadius: 4, height: 18, overflow: "hidden" }}>
            <div style={{ width: `${(Math.abs(l.valor) / maior) * 100}%`, minWidth: 6, height: "100%", borderRadius: 4, background: l.cor ?? cor }} />
          </div>
          <span style={{ width: larguraTexto, textAlign: "right", fontSize: 13, fontWeight: 600, color: l.alerta ? tema.danger : tema.heading, whiteSpace: "nowrap" }}>{l.texto}</span>
        </div>
      ))}
    </div>
  );
}

// Evolução mês a mês — barra de % por competência (igual ao app principal).
export function EvolucaoBarras({ pontos }: { pontos: { rotulo: string; pct: number; ok: number; pendentes: number; titulo?: string }[] }) {
  if (pontos.length === 0) return <div style={{ ...cardStyle, color: tema.muted }}>Nenhuma execução registrada ainda.</div>;
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 12, color: tema.muted, marginBottom: 10 }}>% de conciliação automática por competência (última execução de cada mês). Meta: 100%.</div>
      {pontos.map((p) => (
        <div key={p.rotulo} title={p.titulo} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
          <span style={{ width: 64, fontSize: 13, color: tema.muted }}>{p.rotulo}</span>
          <div style={{ flex: 1, background: tema.bg, borderRadius: 4, height: 18, overflow: "hidden" }}>
            <div style={{ width: `${p.pct}%`, minWidth: 6, height: "100%", borderRadius: 4, background: p.pct >= 95 ? tema.ok : p.pct >= 85 ? tema.amber : tema.danger }} />
          </div>
          <span style={{ width: 60, textAlign: "right", fontSize: 13, fontWeight: 700, color: tema.heading }}>{Math.round(p.pct)}%</span>
          <span style={{ width: 200, textAlign: "right", fontSize: 12, color: tema.muted }}>{fmtInt(p.ok)} ok · {fmtInt(p.pendentes)} pendentes</span>
        </div>
      ))}
    </div>
  );
}

// Cards por responsável — igual ao "Pendências por responsável" do app principal.
export function CardsResponsavel({ linhas }: { linhas: { nome: string; abertas: number; concluidas: number; sub?: string }[] }) {
  if (linhas.length === 0) return <div style={{ ...cardStyle, color: tema.ok, fontSize: 13.5 }}>Nenhuma pendência atribuída.</div>;
  return (
    <div className="gridCards">
      {linhas.map((l) => (
        <div key={l.nome} style={{ ...cardStyle, minWidth: 0 }}>
          <div style={kickerStyle}>{l.nome}</div>
          <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.8 }}>
            <span style={{ color: tema.danger, fontWeight: 700 }}>{l.abertas}</span> abertas
            <br />
            <span style={{ color: tema.ok, fontWeight: 700 }}>{l.concluidas}</span> concluídas
            {l.sub && (
              <>
                <br />
                <span style={{ color: tema.muted, fontSize: 12 }}>{l.sub}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Tabela simples (mesmo estilo das tabelas do app principal).
export interface Coluna<T> {
  titulo: string;
  valor: (l: T) => ReactNode;
  alinhar?: "left" | "right";
}
export function Tabela<T>({ colunas, linhas, chave, vazio = "Sem dados." }: { colunas: Coluna<T>[]; linhas: T[]; chave: (l: T, i: number) => string; vazio?: string }) {
  return (
    <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
      {linhas.length === 0 ? (
        <div style={{ padding: 16, color: tema.muted, fontSize: 13.5 }}>{vazio}</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ color: tema.muted, textAlign: "left" }}>
              {colunas.map((c) => (
                <th key={c.titulo} style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap", borderBottom: `1px solid ${tema.line}`, textAlign: c.alinhar ?? "left" }}>{c.titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={chave(l, i)}>
                {colunas.map((c) => (
                  <td key={c.titulo} style={{ padding: "10px 12px", borderBottom: `1px solid ${tema.line}`, textAlign: c.alinhar ?? "left", whiteSpace: "nowrap" }}>{c.valor(l)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function Pill({ texto, fg, bg }: { texto: string; fg: string; bg: string }) {
  return <span style={{ display: "inline-block", background: bg, color: fg, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{texto}</span>;
}

export function Carregando({ texto }: { texto: string }) {
  return (
    <div style={{ ...cardStyle, color: tema.muted, display: "flex", alignItems: "center", gap: 10 }} aria-busy="true">
      <span className="spinner" /> {texto}
    </div>
  );
}

export const brlOuTraco = (v: number) => (Math.abs(v) < 0.005 ? "" : brl(v));
// Formato executivo para valores grandes nos cards (o valor completo vai no sub/title).
export function brlExec(v: number): string {
  const a = Math.abs(v);
  const sinal = v < 0 ? "-" : "";
  if (a >= 1_000_000) return `${sinal}R$ ${(a / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  return brl(v);
}
export const linkStyle: CSSProperties = { background: "none", border: "none", color: tema.blue, cursor: "pointer", fontSize: "inherit", padding: 0, textDecoration: "underline" };
