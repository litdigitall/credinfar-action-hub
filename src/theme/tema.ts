// Tokens da identidade visual (os mesmos das variáveis CSS em index.css),
// para os estilos inline que ainda existem nas telas.
import type { CSSProperties } from "react";
import type { Risco, Severidade, StatusRemessa, TipoAcao } from "../models/types";

export const tema = {
  bg: "#EEF2F7",
  surface: "#FFFFFF",
  surface2: "#F9FBFD",
  ink: "#17263A",
  heading: "#0B1A2C",
  muted: "#64748B",
  line: "#E4EAF2",
  line2: "#D5DEE9",

  blue: "#007ACC",
  blueDark: "#005C99",
  navy: "#004982",
  blueSoft: "#E8F3FC",
  grape: "#7C35FF",
  grapeSoft: "#F2EAFF",
  amber: "#E8590C",
  amberBg: "#FFF1E6",
  ok: "#2F9E44",
  okBg: "#E9F9EE",
  danger: "#E03131",
  dangerBg: "#FFF0F0",

  sidebarGradient: "linear-gradient(180deg, #06305A 0%, #004982 45%, #2C1C62 130%)",
  avatarGradient: "linear-gradient(60deg, #007ACC 0%, #7C35FF 100%)",
  brandGradient: "linear-gradient(60deg, #006BB3 0%, #7C35FF 100%)",
  heroGradient: "linear-gradient(115deg, #06305A 0%, #004982 40%, #0A63A8 68%, #3A1D6E 130%)",

  font: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'Cascadia Code', 'Consolas', 'SF Mono', monospace",
  radius: 16,
  shadow: "0 1px 2px rgba(11,26,44,.05), 0 2px 10px rgba(11,26,44,.05)",
} as const;

type Cor = { fg: string; bg: string };

export const corSeveridade: Record<Severidade, Cor> = {
  Crítica: { fg: tema.danger, bg: tema.dangerBg },
  Importante: { fg: tema.amber, bg: tema.amberBg },
  Informativa: { fg: tema.blueDark, bg: tema.blueSoft },
};
export const corTipoAcao: Record<TipoAcao, Cor> = {
  BLOCKER: { fg: "#fff", bg: tema.danger },
  DECISION: { fg: "#fff", bg: tema.grape },
  WARNING: { fg: "#fff", bg: tema.amber },
  INFO: { fg: "#fff", bg: tema.blue },
};
export const corStatusRemessa: Record<StatusRemessa, Cor> = {
  RECEIVED: { fg: tema.muted, bg: tema.bg },
  PROCESSING: { fg: tema.blueDark, bg: tema.blueSoft },
  ACTION_REQUIRED: { fg: tema.danger, bg: tema.dangerBg },
  READY_FOR_APPROVAL: { fg: tema.amber, bg: tema.amberBg },
  APPROVED: { fg: tema.grape, bg: tema.grapeSoft },
  GENERATED: { fg: tema.blueDark, bg: tema.blueSoft },
  SENT: { fg: tema.ok, bg: tema.okBg },
};
export const corRisco: Record<Risco, Cor> = {
  Baixo: { fg: tema.ok, bg: tema.okBg },
  Médio: { fg: tema.amber, bg: tema.amberBg },
  Alto: { fg: tema.grape, bg: tema.grapeSoft },
  Crítico: { fg: tema.danger, bg: tema.dangerBg },
};

export function brl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round(v * 100) / 100);
}

export const cardStyle: CSSProperties = {
  background: tema.surface,
  border: `1px solid ${tema.line}`,
  borderRadius: tema.radius,
  boxShadow: tema.shadow,
  padding: "18px 20px",
};

export const kickerStyle: CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  fontSize: 11,
  fontWeight: 800,
  color: tema.blue,
};
