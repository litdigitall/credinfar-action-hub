// Histórico: envios feitos, consultas à Credinfar e quem fez o quê.
import { useMemo, useState } from "react";
import { IconDownload } from "@tabler/icons-react";
import { useHub } from "../App";
import { Botao } from "../components/Botao";
import { Chip, inputStyle } from "../components/ui";
import { Section, Tabela, fmtDataHora, fmtInt } from "../components/visual";
import { statusSimples } from "../services/estado";
import type { Consulta, RegistroAuditoria, Remessa } from "../models/types";
import { cardStyle, tema } from "../theme/tema";

const RESULTADO: Record<Consulta["resultado"], { texto: string; ok: boolean }> = {
  OK: { texto: "Respondida", ok: true },
  SEM_DADOS: { texto: "Sem informação", ok: false },
  IP_NAO_AUTORIZADO: { texto: "Recusada (IP)", ok: false },
  LIMITE_EXCEDIDO: { texto: "Limite do mês atingido", ok: false },
  TOKEN_INVALIDO: { texto: "Recusada (chave de acesso)", ok: false },
};

export function Historico() {
  const { estado, avisar, verCliente } = useHub();
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(50);
  const atividades = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return estado.auditoria.filter((a) => !b || `${a.usuario} ${a.acao} ${a.objeto} ${a.detalhe}`.toLowerCase().includes(b));
  }, [estado.auditoria, busca]);

  const exportar = () => {
    const cab = ["Data/hora", "Quem", "O que", "Onde", "Detalhe"];
    const linhas = atividades.map((a) => [fmtDataHora(a.em), a.usuario, a.acao, a.objeto, a.detalhe.replace(/;/g, ",")].join(";"));
    try {
      const url = URL.createObjectURL(new Blob(["﻿" + [cab.join(";"), ...linhas].join("\r\n")], { type: "text/csv;charset=utf-8" }));
      const el = document.createElement("a");
      el.href = url;
      el.download = "historico-credinfar-action-hub.csv";
      el.click();
    } catch {
      avisar("aviso", "O navegador bloqueou o download.");
    }
  };

  return (
    <>
      <Section titulo="Envios à Credinfar">
        <Tabela<Remessa>
          colunas={[
            { titulo: "Mês", valor: (r) => <b>{r.competencia}</b> },
            { titulo: "Carteira recebida em", valor: (r) => fmtDataHora(r.recebidaEm) },
            { titulo: "Clientes enviados", valor: (r) => fmtInt(r.arquivo?.registros ?? r.registros - r.excluidos.length), alinhar: "right" },
            { titulo: "Tirados do envio", valor: (r) => fmtInt(r.excluidos.length), alinhar: "right" },
            { titulo: "Situação", valor: (r) => { const s = statusSimples(r); return <Chip texto={s} fg={s === "Enviada" ? tema.ok : s === "Pronta" ? tema.blueDark : tema.amber} bg={s === "Enviada" ? tema.okBg : s === "Pronta" ? tema.blueSoft : tema.amberBg} />; } },
            { titulo: "Enviado em", valor: (r) => fmtDataHora(r.enviadaEm ?? "") },
            { titulo: "Por", valor: (r) => r.enviadaPor ?? "" },
            { titulo: "Protocolo", valor: (r) => <span style={{ fontFamily: tema.mono, fontSize: 12.5 }}>{r.protocolo ?? ""}</span> },
          ]}
          linhas={estado.remessas}
          chave={(r) => r.id}
          vazio="Nenhum envio ainda."
        />
      </Section>

      <Section titulo="Consultas à Credinfar" sub="Cada consulta respondida conta no limite do mês.">
        <Tabela<Consulta>
          colunas={[
            { titulo: "Quando", valor: (c) => fmtDataHora(c.em) },
            { titulo: "Quem", valor: (c) => c.usuario },
            { titulo: "Cliente", valor: (c) => { const cli = estado.clientes.find((x) => x.id === c.clienteId); return cli ? <button onClick={() => verCliente(cli.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: tema.blue, fontWeight: 700, textDecoration: "underline" }}>{cli.nome}</button> : <span style={{ color: tema.muted }}>CNPJ {c.cnpjRaiz} (não é cliente)</span>; } },
            { titulo: "Resultado", valor: (c) => <Chip texto={RESULTADO[c.resultado].texto} fg={RESULTADO[c.resultado].ok ? tema.ok : tema.danger} bg={RESULTADO[c.resultado].ok ? tema.okBg : tema.dangerBg} /> },
            { titulo: "Balanços", valor: (c) => (c.balancos ? `${c.balancos} períodos` : "sem balanço") },
          ]}
          linhas={estado.consultas.slice(0, 30)}
          chave={(c) => c.id}
          vazio="Nenhuma consulta ainda."
        />
      </Section>

      <Section titulo="Quem fez o quê" sub="Toda correção, retirada, envio e consulta fica registrada com data, pessoa e detalhe.">
        <div style={{ ...cardStyle, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por pessoa, cliente ou atividade" aria-label="Buscar no histórico" style={{ ...inputStyle, width: 320 }} />
          <span style={{ marginLeft: "auto", fontSize: 12.5, color: tema.muted }}>{fmtInt(atividades.length)} registro(s)</span>
          <Botao variante="secundario" tamanho="pequeno" icone={<IconDownload size={15} />} onClick={exportar}>Baixar em Excel (CSV)</Botao>
        </div>
        <Tabela<RegistroAuditoria>
          colunas={[
            { titulo: "Quando", valor: (a) => fmtDataHora(a.em) },
            { titulo: "Quem", valor: (a) => a.usuario },
            { titulo: "O que", valor: (a) => <b>{a.acao}</b> },
            { titulo: "Onde", valor: (a) => a.objeto },
            { titulo: "Detalhe", valor: (a) => <span style={{ whiteSpace: "normal" }}>{a.detalhe}</span> },
          ]}
          linhas={atividades.slice(0, limite)}
          chave={(a) => a.id}
          vazio="Nada registrado."
        />
        {atividades.length > limite && (
          <div style={{ marginTop: 8 }}>
            <Botao variante="link" onClick={() => setLimite((l) => l + 50)}>Mostrar mais</Botao>
          </div>
        )}
      </Section>
    </>
  );
}
