// Consultar cliente: busca, posição conosco e a ficha da Credinfar resumida,
// com uma recomendação em linguagem simples. Os detalhes (fornecedores, série,
// balanços, XML) ficam atrás de "Ver detalhes".
import { useEffect, useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { useHub } from "../App";
import { Botao } from "../components/Botao";
import { DetalhesFicha } from "../components/Ficha";
import { Aviso, Chip, inputStyle } from "../components/ui";
import { MetricCard, Section, fmtInt } from "../components/visual";
import type { RespostaCredinfar } from "../engine/credinfarMock";
import { limiteQuota } from "../engine/credinfarMock";
import { recomendar, SIGNIFICADO_AVALIACAO } from "../engine/recomendacao";
import { brlInt, formatarCnpj, raizCnpj, soDigitos } from "../engine/util";
import { consultasNoCiclo } from "../services/estado";
import type { Cliente } from "../models/types";
import { SEGMENTOS } from "../models/types";
import { cardStyle, corRisco, kickerStyle, tema } from "../theme/tema";

const ERRO_SIMPLES: Record<string, string> = {
  IP_NAO_AUTORIZADO: "A Credinfar recusou a consulta: o endereço de internet (IP) de saída não é o cadastrado. Avise a TI.",
  LIMITE_EXCEDIDO: "O limite mensal de consultas foi atingido. As consultas voltam no próximo mês.",
  TOKEN_INVALIDO: "A Credinfar recusou a consulta: a chave de acesso (token) está ausente ou inválida. Avise a TI.",
  SEM_DADOS: "A Credinfar não tem informação para este CNPJ.",
};

export function Consulta() {
  const { estado, clienteFoco, focarCliente, consultarCredinfar } = useHub();
  const [busca, setBusca] = useState("");
  const [raizAvulsa, setRaizAvulsa] = useState<string | null>(null);
  const [resposta, setResposta] = useState<RespostaCredinfar | null>(null);
  // O cliente escolhido fica no app (não se perde ao trocar de tela)
  const selecionado = clienteFoco;

  useEffect(() => {
    if (!clienteFoco) return; // consulta avulsa (empresa que não é cliente) mantém o resultado
    setRaizAvulsa(null);
    setResposta(null);
  }, [clienteFoco]);

  const b = busca.trim().toLowerCase();
  const digitos = soDigitos(b);
  const resultados = useMemo(() => {
    if (b.length < 3) return [];
    return estado.clientes.filter((c) => c.nome.toLowerCase().includes(b) || (digitos.length >= 4 && c.cnpj.includes(digitos))).slice(0, 8);
  }, [estado.clientes, b, digitos]);
  const atencao = useMemo(
    () =>
      [...estado.clientes]
        .filter((c) => c.risco === "Crítico" || c.risco === "Alto")
        .sort((x, y) => y.debitoVencido - x.debitoVencido)
        .slice(0, 8),
    [estado.clientes]
  );
  const cliente: Cliente | null = selecionado ? (estado.clientes.find((c) => c.id === selecionado) ?? null) : null;
  const usadas = consultasNoCiclo(estado);
  const limite = limiteQuota(estado.parametros);
  const podeForaDaCarteira = digitos.length === 8 && resultados.length === 0;

  const escolher = (id: string) => {
    focarCliente(id);
    setRaizAvulsa(null);
    setResposta(null);
    setBusca("");
  };

  return (
    <>
      <Section titulo="Quem você quer consultar?" sub={`Consultas à Credinfar neste mês: ${fmtInt(usadas)} de ${fmtInt(limite)}.`}>
        <div style={cardStyle}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconSearch size={18} color={tema.muted} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do cliente ou CNPJ" aria-label="Buscar cliente" style={{ ...inputStyle, fontSize: 15, padding: "11px 14px" }} autoFocus />
          </span>
          {resultados.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {resultados.map((c) => (
                <button key={c.id} onClick={() => escolher(c.id)} style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 10, padding: "9px 10px", border: "none", borderBottom: `1px solid ${tema.line}`, background: "none", cursor: "pointer", textAlign: "left", fontSize: 13.5 }}>
                  <span style={{ fontWeight: 700, color: tema.heading }}>{c.nome}</span>
                  <span style={{ color: tema.muted, fontFamily: tema.mono, fontSize: 12.5 }}>{formatarCnpj(c.cnpj)} · {c.cidade}/{c.uf}</span>
                </button>
              ))}
            </div>
          )}
          {podeForaDaCarteira && (
            <div style={{ marginTop: 10 }}>
              <Botao variante="secundario" tamanho="pequeno" onClick={() => { focarCliente(null); setRaizAvulsa(digitos); setResposta(consultarCredinfar(digitos)); }}>
                Consultar o CNPJ {digitos} (não é nosso cliente)
              </Botao>
            </div>
          )}
          {b.length >= 3 && resultados.length === 0 && !podeForaDaCarteira && <div style={{ marginTop: 8, fontSize: 13, color: tema.muted }}>Nenhum cliente encontrado. Para consultar uma empresa que não é cliente, digite os 8 primeiros dígitos do CNPJ.</div>}
          {!cliente && !raizAvulsa && b.length < 3 && (
            <div style={{ marginTop: 12 }}>
              <div style={kickerStyle}>Clientes que pedem atenção</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {atencao.map((c) => (
                  <button key={c.id} onClick={() => escolher(c.id)} style={{ border: `1px solid ${tema.line}`, background: tema.surface, borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontSize: 13, color: tema.heading }}>
                    {c.nome.split(" ").slice(0, 3).join(" ")} <span style={{ color: corRisco[c.risco].fg, fontWeight: 700 }}>· {c.risco}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {cliente && (
        <Section titulo={cliente.nome} sub={`${formatarCnpj(cliente.cnpj)} · ${cliente.cidade}/${cliente.uf} · ${SEGMENTOS[cliente.segmento]} · ${cliente.canal}`}>
          <div className="gridKpi">
            <MetricCard label="Limite de crédito" valor={brlInt(cliente.limite)} />
            <MetricCard label="Débito conosco" valor={brlInt(cliente.debitoAtual)} cor={cliente.debitoAtual > cliente.limite ? tema.danger : tema.ink} sub={cliente.limite > 0 ? `${Math.round((cliente.debitoAtual / cliente.limite) * 100)}% do limite` : ""} />
            <MetricCard label="Vencido conosco" valor={brlInt(cliente.debitoVencido)} cor={cliente.debitoVencido > 0 ? tema.amber : tema.ok} sub={cliente.diasAtraso ? `${cliente.diasAtraso} dias de atraso médio` : "em dia"} />
            <MetricCard label="Risco interno" valor={cliente.risco} cor={corRisco[cliente.risco].fg} />
          </div>
          <div style={{ ...cardStyle, marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13.5, color: tema.ink }}>
              <b>O que o mercado diz deste cliente?</b> A ficha da Credinfar mostra como ele paga os outros fornecedores (dados de ontem).
            </div>
            <Botao onClick={() => setResposta(consultarCredinfar(raizCnpj(cliente.cnpj)))}>Consultar na Credinfar</Botao>
          </div>
        </Section>
      )}

      {resposta && <Resultado resposta={resposta} cliente={cliente} raiz={cliente ? raizCnpj(cliente.cnpj) : (raizAvulsa ?? "")} />}
    </>
  );
}

function Resultado({ resposta, cliente, raiz }: { resposta: RespostaCredinfar; cliente: Cliente | null; raiz: string }) {
  const f = resposta.ficha;
  if (!f) {
    return (
      <Section titulo="Resposta da Credinfar">
        <Aviso tipo={resposta.resultado === "SEM_DADOS" ? "aviso" : "erro"}>{ERRO_SIMPLES[resposta.resultado] ?? "A consulta não pôde ser feita."}</Aviso>
      </Section>
    );
  }
  const rec = recomendar(f, cliente);
  const corAval = f.avaliacao <= "B" ? tema.ok : f.avaliacao === "C" ? tema.amber : tema.danger;
  const oc = f.ocorrencias;
  const totalOc = oc.protestos + oc.cheques + oc.acoes + oc.inadimplencias + oc.falencias;
  const bal = f.balancos[f.balancos.length - 1];
  return (
    <Section titulo={cliente ? "Ficha na Credinfar" : `Ficha na Credinfar · ${f.nome}`} sub={`CNPJ raiz ${raiz} · dados de ${f.dataBase}`}>
      <div style={{ ...cardStyle, borderLeft: `5px solid ${rec.tom === "ok" ? tema.ok : rec.tom === "aviso" ? tema.amber : tema.danger}`, marginBottom: 12 }}>
        <div style={kickerStyle}>Recomendação</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: tema.heading, marginTop: 4 }}>{rec.titulo}</div>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: tema.ink }}>
          {rec.motivos.map((m) => <li key={m}>{m}</li>)}
        </ul>
      </div>
      <div className="gridKpi">
        <MetricCard label="Avaliação da Credinfar" valor={`${f.avaliacao} · ${SIGNIFICADO_AVALIACAO[f.avaliacao] ?? ""}`} cor={corAval} sub="de A (melhor) a E (pior)" />
        <MetricCard label="Deve no mercado" valor={brlInt(f.debitoAtualRede)} sub={`${f.fontes.length} fornecedores informando`} />
        <MetricCard label="Vencido no mercado" valor={brlInt(f.debitoVencidoRede)} cor={f.percentualVencido > 20 ? tema.danger : f.percentualVencido > 5 ? tema.amber : tema.ok} sub={`${f.percentualVencido.toFixed(1)}% do que deve`} />
        <MetricCard label="Ocorrências" valor={fmtInt(totalOc)} cor={totalOc ? tema.danger : tema.ok} sub={totalOc ? [oc.protestos && `${oc.protestos} protesto(s)`, oc.cheques && `${oc.cheques} cheque(s)`, oc.acoes && `${oc.acoes} ação(ões)`, oc.inadimplencias && `${oc.inadimplencias} inadimplência(s)`, oc.falencias && "falência/recuperação"].filter(Boolean).join(" · ") : "nada registrado"} />
      </div>
      <div style={{ ...cardStyle, marginTop: 12, fontSize: 13.5, lineHeight: 1.7 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <Chip texto={`Situação ${f.situacaoCadastral}`} fg={f.situacaoCadastral === "ATIVA" ? tema.ok : tema.danger} bg={f.situacaoCadastral === "ATIVA" ? tema.okBg : tema.dangerBg} />
          <Chip texto={`${f.consultasMes} consultas de fornecedores neste mês`} fg={tema.blueDark} bg={tema.blueSoft} />
        </div>
        <b>Balanço mais recente:</b>{" "}
        {bal ? `${bal.dataBalanco}, conceito ${bal.conceitoGlobal} (nota ${bal.notaGlobal}), liquidez corrente ${bal.liqCorrente.toLocaleString("pt-BR")}, endividamento ${bal.endivGeral}%, resultado ${brlInt(bal.lucroLiquido)}.` : "a Credinfar não tem balanço deste cliente."}
        <br />
        <b>O que a Credinfar destaca:</b> {f.frases.filter(Boolean).join(". ")}.
      </div>
      <details style={{ ...cardStyle, marginTop: 12 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, color: tema.blueDark }}>Ver detalhes</summary>
        <div style={{ marginTop: 12 }}>
          <DetalhesFicha resposta={resposta} />
        </div>
      </details>
    </Section>
  );
}
