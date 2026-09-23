import type { ButtonHTMLAttributes, ReactNode } from "react";

// Botão único do app: primário (gradiente da marca), secundário (contorno),
// perigo, link, ghost e claro (sobre fundo escuro). Os rótulos são contratos
// com os testes.
export type VarianteBotao = "primario" | "secundario" | "perigo" | "link" | "ghost" | "claro";
export type TamanhoBotao = "normal" | "pequeno";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  icone?: ReactNode;
  children?: ReactNode;
}

export function Botao({ variante = "primario", tamanho = "normal", icone, children, className, type = "button", ...resto }: Props) {
  const classes = ["btn", `btn-${variante}`, tamanho === "pequeno" ? "btn-sm" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} {...resto}>
      {icone && (
        <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }} aria-hidden="true">
          {icone}
        </span>
      )}
      {children}
    </button>
  );
}
