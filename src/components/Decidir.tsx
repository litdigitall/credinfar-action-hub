// Cartão de decisão e o modal que confirma a ação. Uma decisão por vez:
// o que está acontecendo, por que importa e o que dá para fazer.
import { useState } from "react";
import type { CSSProperties } from "react";
import { IconAlertTriangle, IconPhoneCall, IconTrendingUp } from "@tabler/icons-react";
import { Botao } from "./Botao";
import { Campo, Modal, inputStyle } from "./ui";
import { brlInt } from "../engine/util";
import type { ExtrasDecisao } from "../services/estado";
import type { Cliente, OpcaoAcao, TipoSinal } from "../models/types";
import { tema } from "../theme/tema";

export const ROTULO_TIPO: Record<TipoSinal, string> = { RISCO: "Risco", COBRANCA: "Cobrança", OPORTUNIDADE: "Vender mais" };
export const COR_TIPO: Record<TipoSinal, [string, string]> = {
  RISCO: [tema.danger, tema.dangerBg],
  COBRANCA: [tema.amber, tema.amberBg],
  OPORTUNIDADE: [tema.ok, tema.okBg],
};
const ICONE_TIPO: Record<TipoSinal, typeof IconAlertTriangle> = { RISCO: IconAlertTriangle, COBRANCA: IconPhoneCall, OPORTUNIDADE: IconTrendingUp };
const VALOR_TIPO: Record<TipoSinal, string> = { RISCO: "em risco", COBRANCA: "a receber", OPORTUNIDADE: "de limite a mais" };
const COR_BARRA = { verde: tema.ok, amarelo: tema.amber, vermelho: tema.danger } as const;

export function CartaoDecisao({
  nome,
  tipo,
  cor,
  titulo,
  porque,
  valorEmJogo,
  opcoes,
  onAbrirCliente,
  onEscolher,
}: {
  nome?: string;
  tipo: TipoSinal | null;
  cor: "verde" | "amarelo" | "vermelho";
  titulo: string;
  porque: string[];
  valorEmJogo: number;
  opcoes: OpcaoAcao[];
  onAbrirCliente?: () => void;
  onEscolher: (o: OpcaoAcao) => void;
}) {
  const [mais, setMais] = useState(false);
  const principais = opcoes.slice(0, 2);
  const resto = opcoes.slice(2);
  const Icone = tipo ? ICONE_TIPO[tipo] : null;
  return (
    <article data-testid="decisao" className="decisao card-hover" style={{ "--cor": COR_BARRA[cor] } as CSSProperties}>
      <div className="cabeca" style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0, flexWrap: "wrap" }}>
        {tipo && Icone && (
          <span className="chip" style={{ background: COR_TIPO[tipo][1], color: COR_TIPO[tipo][0] }}>
            <Icone size={13} /> {ROTULO_TIPO[tipo]}
          </span>
        )}
        {nome &&
          (onAbrirCliente ? (
            <button className="nome" onClick={onAbrirCliente} title="Abrir o cliente">
              {nome}
            </button>
          ) : (
            <span className="nome" style={{ cursor: "default" }}>{nome}</span>
          ))}
      </div>
      {tipo && valorEmJogo > 0 && (
        <div className="valor num">
          <b>{brlInt(valorEmJogo)}</b>
          <span>{VALOR_TIPO[tipo]}</span>
        </div>
      )}
      <h3>{titulo}</h3>
      <ul>
        {porque.slice(0, 4).map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      {opcoes.length > 0 && (
        <div className="acoes">
          {principais.map((o, i) => (
            <Botao key={o.rotulo} variante={i === 0 ? "primario" : "secundario"} tamanho="pequeno" onClick={() => onEscolher(o)}>
              {o.rotulo}
            </Botao>
          ))}
          {resto.length > 0 && !mais && (
            <Botao variante="link" tamanho="pequeno" onClick={() => setMais(true)}>
              Outras opções
            </Botao>
          )}
          {mais &&
            resto.map((o) => (
              <Botao key={o.rotulo} variante="secundario" tamanho="pequeno" onClick={() => onEscolher(o)}>
                {o.rotulo}
              </Botao>
            ))}
        </div>
      )}
    </article>
  );
}

// Confirmação da decisão: pede só o que a ação precisa.
export function ModalDecisao({ cliente: c, opcao, onFechar, onConfirmar }: { cliente: Cliente; opcao: OpcaoAcao; onFechar: () => void; onConfirmar: (extras: ExtrasDecisao) => void }) {
  const [limite, setLimite] = useState(opcao.novoLimite ?? c.limite);
  const [nota, setNota] = useState("");
  const [promessa, setPromessa] = useState("");
  const num = (v: string) => Math.max(0, Math.round(Number(v.replace(/\D/g, "")) || 0));
  const explicacao: Record<OpcaoAcao["acao"], string> = {
    AJUSTAR_LIMITE: "O novo limite vale a partir de agora. Em produção, a mudança segue para o ERP.",
    PEDIR_GARANTIA: "O cliente fica marcado: novas vendas só com garantia ou pagamento antecipado.",
    BLOQUEAR_VENDAS: "O cliente fica marcado: novas vendas a prazo seguradas até você liberar.",
    REGISTRAR_CONTATO: "Anote o que foi combinado. Se houver promessa de pagamento, informe a data.",
    ACOMPANHAR: "Nada muda. O cliente sai da lista deste mês e volta na próxima leitura se continuar assim.",
  };
  return (
    <Modal titulo={`${opcao.rotulo} · ${c.nome}`} aberto onFechar={onFechar} largura={540}>
      <div style={{ fontSize: 13.5, color: tema.ink, lineHeight: 1.6 }}>{explicacao[opcao.acao]}</div>
      {opcao.acao === "AJUSTAR_LIMITE" && (
        <Campo rotulo="Novo limite de crédito" ajuda={`Hoje: limite ${brlInt(c.limite)}, deve ${brlInt(c.debitoAtual)}.`}>
          <input value={limite} onChange={(e) => setLimite(num(e.target.value))} style={{ ...inputStyle, fontSize: 18, fontWeight: 800 }} inputMode="numeric" aria-label="Novo limite" />
        </Campo>
      )}
      {opcao.acao === "REGISTRAR_CONTATO" && (
        <Campo rotulo="Prometeu pagar em (opcional)">
          <input type="date" value={promessa} onChange={(e) => setPromessa(e.target.value)} style={inputStyle} aria-label="Data prometida" />
        </Campo>
      )}
      <Campo rotulo={opcao.acao === "REGISTRAR_CONTATO" ? "O que foi combinado" : "Observação (opcional)"}>
        <input value={nota} onChange={(e) => setNota(e.target.value)} style={inputStyle} placeholder={opcao.acao === "REGISTRAR_CONTATO" ? "Ex.: falei com o financeiro, boleto não tinha chegado" : "Fica no histórico"} aria-label="Observação" />
      </Campo>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao onClick={() => onConfirmar({ novoLimite: opcao.acao === "AJUSTAR_LIMITE" ? limite : undefined, nota: nota.trim() || undefined, promessaEm: promessa || undefined })}>Confirmar</Botao>
      </div>
    </Modal>
  );
}
