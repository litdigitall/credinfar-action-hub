// Detalhes da ficha Credinfar (para quem quer ir além do resumo): fornecedores
// que informam, série de 12 meses, balanços e o XML bruto da resposta.
import { useState } from "react";
import { Codigo } from "./ui";
import { Tabela, fmtInt } from "./visual";
import type { RespostaCredinfar } from "../engine/credinfarMock";
import { brlInt } from "../engine/util";
import { tema } from "../theme/tema";

type Guia = "fontes" | "serie" | "balancos" | "xml";

export function DetalhesFicha({ resposta }: { resposta: RespostaCredinfar }) {
  const [guia, setGuia] = useState<Guia>("fontes");
  const f = resposta.ficha;
  if (!f) return <Codigo altura={200}>{resposta.xml}</Codigo>;
  const guias: { id: Guia; rotulo: string }[] = [
    { id: "fontes", rotulo: "Fornecedores que informam" },
    { id: "serie", rotulo: "Últimos 12 meses" },
    { id: "balancos", rotulo: "Balanços" },
    { id: "xml", rotulo: "Resposta técnica (XML)" },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${tema.line}`, flexWrap: "wrap" }}>
        {guias.map((g) => (
          <button key={g.id} onClick={() => setGuia(g.id)} style={{ background: "none", border: "none", borderBottom: guia === g.id ? `2px solid ${tema.blue}` : "2px solid transparent", padding: "6px 10px", cursor: "pointer", fontWeight: guia === g.id ? 700 : 500, color: guia === g.id ? tema.blueDark : tema.muted, fontSize: 13 }}>
            {g.rotulo}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        {guia === "fontes" && (
          <>
            <div style={{ fontSize: 12.5, color: tema.muted, marginBottom: 6 }}>A Credinfar mostra até os 10 maiores fornecedores, sem dizer quem são. Total informando: {f.totalFontes}.</div>
            <Tabela
              colunas={[
                { titulo: "Fornecedor", valor: (x) => <b>{x.fonte}</b> },
                { titulo: "Cliente desde", valor: (x) => x.clienteDesde },
                { titulo: "Limite", valor: (x) => (x.limite ? brlInt(x.limite) : ""), alinhar: "right" },
                { titulo: "Débito", valor: (x) => brlInt(x.debitoAtual), alinhar: "right" },
                { titulo: "Vencido", valor: (x) => brlInt(x.debitoVencido), alinhar: "right" },
                { titulo: "Atraso médio", valor: (x) => `${x.mediaAtraso} dias`, alinhar: "right" },
              ]}
              linhas={f.fontes}
              chave={(x) => x.fonte}
            />
          </>
        )}
        {guia === "serie" && (
          <Tabela
            colunas={[
              { titulo: "Mês", valor: (m) => m.mes },
              { titulo: "Compras", valor: (m) => brlInt(m.compra), alinhar: "right" },
              { titulo: "Débito", valor: (m) => brlInt(m.debito), alinhar: "right" },
              { titulo: "Vencido", valor: (m) => brlInt(m.vencido), alinhar: "right" },
              { titulo: "Prazo médio", valor: (m) => `${m.dso} dias`, alinhar: "right" },
              { titulo: "Consultas", valor: (m) => fmtInt(m.consultas), alinhar: "right" },
            ]}
            linhas={f.serieMeses}
            chave={(m) => m.mes}
          />
        )}
        {guia === "balancos" &&
          (f.balancos.length === 0 ? (
            <div style={{ color: tema.muted, fontSize: 13 }}>A Credinfar não tem balanço deste cliente. Quando tem, vêm os três últimos.</div>
          ) : (
            <Tabela
              colunas={[
                { titulo: "Data", valor: (b) => <b>{b.dataBalanco}</b> },
                { titulo: "Receita", valor: (b) => brlInt(b.receitaLiquida), alinhar: "right" },
                { titulo: "Resultado", valor: (b) => <span style={{ color: b.lucroLiquido < 0 ? tema.danger : tema.ok }}>{brlInt(b.lucroLiquido)}</span>, alinhar: "right" },
                { titulo: "Patrimônio líquido", valor: (b) => brlInt(b.patrimonioLiquido), alinhar: "right" },
                { titulo: "Liquidez corrente", valor: (b) => b.liqCorrente.toLocaleString("pt-BR"), alinhar: "right" },
                { titulo: "Endividamento", valor: (b) => `${b.endivGeral}%`, alinhar: "right" },
                { titulo: "Conceito", valor: (b) => `${b.conceitoGlobal} (nota ${b.notaGlobal})` },
              ]}
              linhas={f.balancos}
              chave={(b) => b.dataBalanco}
            />
          ))}
        {guia === "xml" && <Codigo altura={380}>{resposta.xml}</Codigo>}
      </div>
    </div>
  );
}
