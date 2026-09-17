// Peças de interface do Action Hub: modal, campos de formulário, chips,
// avisos e bloco de código.
import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
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
    <div role="dialog" aria-modal="true" aria-label={titulo} onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(15,31,48,0.45)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: largura, background: tema.surface, borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,0.25)", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: tema.heading }}>{titulo}</div>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: "none", border: "none", cursor: "pointer", color: tema.muted }}>
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
  border: `1px solid ${tema.line}`,
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13.5,
  background: tema.surface,
  color: tema.ink,
  boxSizing: "border-box",
};
export const rotuloStyle: CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: tema.muted, marginBottom: 4, marginTop: 10 };

export function Campo({ rotulo, children, ajuda }: { rotulo: string; children: ReactNode; ajuda?: string }) {
  return (
    <label style={{ display: "block" }}>
      <span style={rotuloStyle}>{rotulo}</span>
      {children}
      {ajuda && <span style={{ display: "block", fontSize: 11.5, color: tema.muted, marginTop: 3 }}>{ajuda}</span>}
    </label>
  );
}

export function Chip({ texto, fg, bg, title }: { texto: ReactNode; fg: string; bg: string; title?: string }) {
  return (
    <span title={title} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: bg, color: fg, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      {texto}
    </span>
  );
}

export function Aviso({ tipo, children }: { tipo: "ok" | "erro" | "aviso" | "info"; children: ReactNode }) {
  const cores = { ok: [tema.ok, tema.okBg], erro: [tema.danger, tema.dangerBg], aviso: [tema.amber, tema.amberBg], info: [tema.blueDark, tema.blueSoft] }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} style={{ background: cores[1], color: cores[0], borderRadius: 10, padding: "10px 14px", fontSize: 13.5, lineHeight: 1.55, marginTop: 10 }}>
      {children}
    </div>
  );
}

export const Codigo = ({ children, altura = 360 }: { children: ReactNode; altura?: number }) => (
  <pre style={{ background: "#0F1F30", color: "#D6E4F0", borderRadius: 10, padding: 14, fontSize: 11.5, lineHeight: 1.5, overflow: "auto", maxHeight: altura, margin: 0, fontFamily: tema.mono, whiteSpace: "pre" }}>{children}</pre>
);
