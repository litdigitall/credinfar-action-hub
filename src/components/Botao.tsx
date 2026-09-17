import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { tema } from "../theme/tema";

// Botão único do app — quatro variantes com a identidade Abbott (CFS Navigator):
//   primario   → gradiente da marca (ações principais: Executar, Salvar, Incluir…)
//   secundario → contorno azul sobre fundo transparente (Exportar CSV, Anotar…)
//   perigo     → vermelho sólido (Desfazer vínculo, Zerar base)
//   link       → texto azul sublinhado, sem caixa (Limpar filtros, atalhos)
// Os TEXTOS dos botões são contratos com os E2E — nunca mude rótulos aqui.
export type VarianteBotao = "primario" | "secundario" | "perigo" | "link";
export type TamanhoBotao = "normal" | "pequeno";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  icone?: ReactNode;
  children?: ReactNode;
}

export function Botao({
  variante = "primario",
  tamanho = "normal",
  icone,
  children,
  disabled,
  style,
  type = "button",
  ...resto
}: Props) {
  const estilo: CSSProperties = {
    ...base,
    ...(tamanho === "pequeno" ? pequeno : normal),
    ...variantes[variante],
    ...(disabled ? desabilitadoPor[variante] : null),
    ...style,
  };
  return (
    <button type={type} disabled={disabled} style={estilo} {...resto}>
      {icone && (
        <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }} aria-hidden="true">
          {icone}
        </span>
      )}
      {children}
    </button>
  );
}

const base: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  border: "none",
  borderRadius: tema.radius,
  fontFamily: "inherit",
  fontWeight: 700,
  lineHeight: 1.2,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "filter 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease",
};

const normal: CSSProperties = { padding: "10px 20px", fontSize: 14 };
const pequeno: CSSProperties = { padding: "7px 14px", fontSize: 13, fontWeight: 600 };

const variantes: Record<VarianteBotao, CSSProperties> = {
  primario: {
    background: tema.brandGradient,
    color: "#fff",
    boxShadow: "0 8px 20px rgba(0,107,179,0.30)",
  },
  secundario: {
    background: "transparent",
    color: tema.blue,
    border: `1px solid ${tema.blue}`,
  },
  perigo: {
    background: tema.danger,
    color: "#fff",
  },
  link: {
    background: "none",
    color: tema.blue,
    padding: 0,
    fontSize: "inherit",
    fontWeight: 600,
    textDecoration: "underline",
    borderRadius: 0,
    whiteSpace: "normal",
  },
};

const desabilitadoPor: Record<VarianteBotao, CSSProperties> = {
  primario: { background: tema.muted, boxShadow: "none", cursor: "default" },
  secundario: { color: tema.muted, borderColor: tema.line, cursor: "default" },
  perigo: { background: tema.line, color: tema.muted, cursor: "default" },
  link: { color: tema.muted, cursor: "default", textDecoration: "none" },
};
