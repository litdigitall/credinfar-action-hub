// Identidade visual dos Hubs (CFS Navigator / Abbott): Primary Blue #007ACC,
// Medium Blue #004982, acento grape, fonte Inter, cards com sombra suave.
import type { CSSProperties } from "react";
import type { Risco, Severidade, StatusRemessa, TipoAcao } from "../models/types";

export const tema = {
  bg: "#F4F6FA",
  surface: "#FFFFFF",
  ink: "#1A2B3C",
  heading: "#0F1F30",
  muted: "#64748B",
  line: "#E7EDF4",

  blue: "#007ACC",
  blueDark: "#005C99",
  navy: "#004982",
  blueSoft: "#E6F3FB",
  grape: "#7C35FF",
  grapeSoft: "#F1E8FF",
  amber: "#E8590C",
  amberBg: "#FFF4E6",
  ok: "#2F9E44",
  okBg: "#EBFBEE",
  danger: "#E03131",
  dangerBg: "#FFF5F5",

  sidebarGradient: "linear-gradient(180deg, #004982 0%, #005C99 55%, #3a1d6e 130%)",
  avatarGradient: "linear-gradient(60deg, #007ACC 0%, #7C35FF 100%)",
  brandGradient: "linear-gradient(60deg, #006BB3 0%, #7C35FF 100%)",
  heroGradient: "linear-gradient(115deg, #003a6b 0%, #005C99 45%, #0a63a8 70%, #3a1d6e 130%)",

  font: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'Cascadia Code', 'Consolas', monospace",
  radius: 12,
  shadow: "0 2px 8px rgba(16,24,40,.06)",
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
  padding: 16,
};

export const kickerStyle: CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 11,
  fontWeight: 700,
  color: tema.blue,
};
