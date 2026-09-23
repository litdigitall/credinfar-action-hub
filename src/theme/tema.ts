// Tokens da identidade visual (os mesmos das variáveis CSS em index.css),
// para os estilos inline que ainda existem nas telas.
import type { CSSProperties } from "react";
import type { Risco, Severidade, StatusRemessa, TipoAcao } from "../models/types";

export const tema = {
  bg: "#F2F5F6",
  surface: "#FFFFFF",
  surface2: "#F7F9FA",
  ink: "#344042",
  heading: "#000075",
  muted: "#66777A",
  line: "#E4EEEF",
  line2: "#D0DDDD",

  blue: "#2E4AED",
  blueDark: "#1D34C4",
  navy: "#000075",
  blueSoft: "#EAEDFE",
  grape: "#8054F2",
  grapeSoft: "#E5DEFC",
  amber: "#D9451B",
  amberBg: "#FCDED4",
  ok: "#1A7F3A",
  okBg: "#E3FAE0",
  danger: "#E5173F",
  dangerBg: "#FFE3E8",
  yellow: "#FFBF21",
  yellowBg: "#FFF2D4",
  yellowInk: "#5C4500",

  sidebarGradient: "linear-gradient(180deg, #000075 0%, #0A1698 55%, #2E4AED 160%)",
  avatarGradient: "linear-gradient(60deg, #2E4AED 0%, #8054F2 100%)",
  brandGradient: "linear-gradient(60deg, #2E4AED 0%, #1B2FB8 100%)",
  heroGradient: "linear-gradient(115deg, #000075 0%, #1B2FB8 45%, #2E4AED 78%, #00BFDE 150%)",

  font: "Roboto, 'Segoe UI', system-ui, -apple-system, sans-serif",
  fontDisplay: "'Outfit Variable', 'Segoe UI', Roboto, sans-serif",
  mono: "'Cascadia Code', 'Consolas', 'SF Mono', monospace",
  radius: 14,
  shadow: "0 1px 2px rgba(0,0,117,.04), 0 2px 10px rgba(0,0,117,.05)",
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
  fontFamily: tema.fontDisplay,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  fontSize: 11,
  fontWeight: 700,
  color: tema.blue,
};
