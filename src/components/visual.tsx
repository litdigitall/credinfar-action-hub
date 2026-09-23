// Peças visuais compartilhadas: seção, número em destaque, tabela, chip de
// carregamento e formatadores.
import type { CSSProperties, ReactNode } from "react";
import { brl, tema } from "../theme/tema";

export const fmtInt = (v: number) => v.toLocaleString("pt-BR");
export const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export const fmtData = (iso: string) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString("pt-BR") : "");
export const fmtDataHora = (iso: string) =>
  iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export function Section({ titulo, sub, acao, children }: { titulo: string; sub?: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }} className="anim-subir">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h2 className="h2" style={{ marginBottom: sub ? 2 : 0 }}>{titulo}</h2>
          {sub && <div style={{ fontSize: 13, color: tema.muted, lineHeight: 1.5 }}>{sub}</div>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

// Número em destaque
export function MetricCard({ label, valor, cor, sub, icone }: { label: string; valor: string; cor?: string; sub?: string; icone?: ReactNode }) {
  return (
    <div className="card card-hover" style={{ minWidth: 0, display: "flex", gap: 14, alignItems: "flex-start" }}>
      {icone && (
        <span style={{ width: 38, height: 38, borderRadius: 12, background: `${cor ?? tema.blue}14`, color: cor ?? tema.blue, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-hidden="true">
          {icone}
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: tema.muted, fontWeight: 600 }}>{label}</div>
        <div className="display num" style={{ fontSize: "clamp(22px, 1.9vw, 28px)", fontWeight: 600, color: cor ?? tema.heading, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }} title={valor}>
          {valor}
        </div>
        {sub && <div style={{ fontSize: 12, color: tema.muted, marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

export interface Coluna<T> {
  titulo: string;
  valor: (l: T) => ReactNode;
  alinhar?: "left" | "right";
}
export function Tabela<T>({ colunas, linhas, chave, vazio = "Sem dados." }: { colunas: Coluna<T>[]; linhas: T[]; chave: (l: T, i: number) => string; vazio?: string }) {
  return (
    <div className="card" style={{ padding: 0, overflowX: "auto" }}>
      {linhas.length === 0 ? (
        <div style={{ padding: 18, color: tema.muted, fontSize: 13.5 }}>{vazio}</div>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c.titulo} style={{ textAlign: c.alinhar ?? "left" }}>{c.titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={chave(l, i)}>
                {colunas.map((c) => (
                  <td key={c.titulo} className={c.alinhar === "right" ? "num" : undefined} style={{ textAlign: c.alinhar ?? "left" }}>{c.valor(l)}</td>
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
  return <span className="chip" style={{ background: bg, color: fg }}>{texto}</span>;
}

export function Carregando({ texto }: { texto: string }) {
  return (
    <div className="card" style={{ color: tema.muted, display: "flex", alignItems: "center", gap: 10 }} aria-busy="true">
      <span className="spinner" /> {texto}
    </div>
  );
}

export const brlOuTraco = (v: number) => (Math.abs(v) < 0.005 ? "" : brl(v));
export function brlExec(v: number): string {
  const a = Math.abs(v);
  const sinal = v < 0 ? "-" : "";
  if (a >= 1_000_000) return `${sinal}R$ ${(a / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (a >= 10_000) return `${sinal}R$ ${(a / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return brl(v);
}
export const linkStyle: CSSProperties = { background: "none", border: "none", color: tema.blue, cursor: "pointer", fontSize: "inherit", padding: 0, textDecoration: "underline" };
