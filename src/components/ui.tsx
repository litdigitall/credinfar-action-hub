// Peças de interface: modal, campos de formulário, chips, avisos e código.
import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { IconAlertCircle, IconCircleCheck, IconInfoCircle, IconX } from "@tabler/icons-react";
import { tema } from "../theme/tema";

export function Modal({ titulo, aberto, onFechar, children, largura = 640 }: { titulo: string; aberto: boolean; onFechar: () => void; children: ReactNode; largura?: number }) {
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, onFechar]);
  if (!aberto) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(11,26,44,0.5)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "7vh 16px", overflowY: "auto", animation: "fundo .2s both" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: largura, background: tema.surface, borderRadius: 20, boxShadow: "0 24px 60px rgba(11,26,44,0.28)", padding: 24, animation: "surgir .3s cubic-bezier(.2,.7,.2,1) both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: tema.heading, letterSpacing: "-0.01em" }}>{titulo}</div>
          <button onClick={onFechar} aria-label="Fechar" className="btn btn-ghost btn-sm" style={{ padding: 6 }}>
            <IconX size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  border: `1px solid ${tema.line2}`,
  borderRadius: 12,
  padding: "11px 14px",
  fontSize: 14,
  background: tema.surface,
  color: tema.ink,
  boxSizing: "border-box",
};
export const rotuloStyle: CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: tema.muted, marginBottom: 5, marginTop: 12 };

export function Campo({ rotulo, children, ajuda }: { rotulo: string; children: ReactNode; ajuda?: string }) {
  return (
    <label style={{ display: "block" }}>
      <span style={rotuloStyle}>{rotulo}</span>
      {children}
      {ajuda && <span style={{ display: "block", fontSize: 11.5, color: tema.muted, marginTop: 4 }}>{ajuda}</span>}
    </label>
  );
}

export function Chip({ texto, fg, bg, title }: { texto: ReactNode; fg: string; bg: string; title?: string }) {
  return (
    <span className="chip" title={title} style={{ background: bg, color: fg }}>
      {texto}
    </span>
  );
}

export function Aviso({ tipo, children }: { tipo: "ok" | "erro" | "aviso" | "info"; children: ReactNode }) {
  const cores = { ok: [tema.ok, tema.okBg], erro: [tema.danger, tema.dangerBg], aviso: [tema.amber, tema.amberBg], info: [tema.blueDark, tema.blueSoft] }[tipo];
  const Icone = tipo === "ok" ? IconCircleCheck : tipo === "info" ? IconInfoCircle : IconAlertCircle;
  return (
    <div role={tipo === "erro" ? "alert" : "status"} style={{ background: cores[1], color: cores[0], borderRadius: 12, padding: "11px 14px", fontSize: 13.5, lineHeight: 1.55, marginTop: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Icone size={18} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export const Codigo = ({ children, altura = 360 }: { children: ReactNode; altura?: number }) => (
  <pre className="codigo" style={{ maxHeight: altura }}>{children}</pre>
);
