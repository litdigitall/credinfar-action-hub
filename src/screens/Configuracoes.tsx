// Configurações: o essencial do envio, o modo demonstração e a ajuda
// (regras em linguagem simples, layout do arquivo, pontos a confirmar).
import { useState } from "react";
import { useHub } from "../App";
import { Botao } from "../components/Botao";
import { Aviso, Campo, inputStyle } from "../components/ui";
import { Section, Tabela } from "../components/visual";
import { limiteQuota } from "../engine/credinfarMock";
import { LAYOUT } from "../engine/infassoc";
import type { Parametros } from "../models/types";
import { cardStyle, tema } from "../theme/tema";

const IP_ESTRANHO = "177.10.20.30";
const TOKEN_DEMO = "TKN-HML-7F3A9C2E5B";

const TRAVAS = [
  ["CNPJ que não confere", "Os dois últimos dígitos do CNPJ não batem. A Credinfar não aceita."],
  ["Cadastro incompleto", "Falta razão social, endereço, cidade, CEP ou UF. O arquivo não pode ter campo em branco."],
  ["Vencidos que não fecham", "A soma das faixas de atraso é diferente do total vencido."],
  ["Valor que não cabe", "Valor negativo ou acima de 999.999.999."],
];
const AVISOS = [
  ["Débito acima do limite", "O cliente deve mais do que o limite de crédito."],
  ["Perto do limite", "O débito já passou de 90% do limite."],
  ["Vencidos há mais de 90 dias", "Vai para a Credinfar e pesa na avaliação do cliente no mercado."],
  ["Sem compra há 6 meses", "Sem débito e sem compra recente. Pode ficar de fora se preferir."],
];
const CONFIRMAR = [
  ["Limite mensal de consultas", "O manual fala em 1,5 vez os registros enviados no mês anterior; outro material fala em 1,5 vez o número de clientes. Pedir a regra por escrito."],
  ["Estrutura do XML", "O manual diz 22 blocos e lista 26. Pedir o esquema oficial."],
  ["Balanço", "As regras mandam excluir a página em dólar e a página de apoio dos índices. Confirmar o efeito no XML."],
  ["Arquivo mensal", "O layout oficial (30 campos, 270 posições) já está aplicado. Validar um arquivo de teste com a Credinfar."],
  ["Produção", "Falta o endereço de produção da API, a chave de acesso e o cadastro do IP de saída."],
];

export function Configuracoes() {
  const { estado, salvarParametros, reiniciar } = useHub();
  const [p, setP] = useState<Parametros>({ ...estado.parametros });
  const [confirmar, setConfirmar] = useState(false);
  const [consultasAntes, setConsultasAntes] = useState<number | null>(null); // para desfazer a simulação do limite
  const atual = estado.parametros;
  const set = <K extends keyof Parametros>(k: K, v: Parametros[K]) => setP({ ...p, [k]: v });
  const num = (v: string) => Math.max(0, Number(v.replace(/\D/g, "")) || 0);
  const limite = limiteQuota(atual);
  const ipOk = atual.ipSaida.trim() === atual.ipCadastrado.trim();
  const quotaCheia = atual.consultasNoMes >= limite;

  return (
    <>
      <Section titulo="Envio mensal">
        <div style={cardStyle}>
          <div className="gridFicha">
            <Campo rotulo="Código da Abbott na Credinfar (3 dígitos)"><input value={p.codAssociada} onChange={(e) => set("codAssociada", e.target.value.replace(/\D/g, "").slice(0, 3))} style={inputStyle} /></Campo>
            <Campo rotulo="Mês do envio (MM/AAAA)"><input value={p.competencia} onChange={(e) => set("competencia", e.target.value)} style={inputStyle} /></Campo>
            <Campo rotulo="Dia do envio"><input value={p.diaEnvio} onChange={(e) => set("diaEnvio", Math.min(28, Math.max(1, num(e.target.value))))} style={inputStyle} inputMode="numeric" /></Campo>
            <Campo rotulo="Clientes enviados no mês anterior" ajuda={`Dá direito a ${Math.floor(p.registrosMesAnterior * 1.5).toLocaleString("pt-BR")} consultas neste mês (1,5 vez).`}><input value={p.registrosMesAnterior} onChange={(e) => set("registrosMesAnterior", num(e.target.value))} style={inputStyle} inputMode="numeric" /></Campo>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Botao onClick={() => salvarParametros(p)}>Gravar</Botao>
            <Botao variante="secundario" onClick={() => setP({ ...estado.parametros })}>Descartar</Botao>
          </div>
        </div>
      </Section>

      <Section titulo="Modo demonstração" sub="Simule as situações em que a Credinfar recusa a consulta. Depois vá em Clientes e consulte a Credinfar.">
        <div style={{ ...cardStyle, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Botao variante="secundario" tamanho="pequeno" onClick={() => salvarParametros({ ...atual, ipSaida: ipOk ? IP_ESTRANHO : atual.ipCadastrado }, ipOk ? "Simulação ligada: IP de saída não cadastrado." : "IP cadastrado restaurado.")}>
            {ipOk ? "Simular IP não cadastrado" : "Voltar ao IP cadastrado"}
          </Botao>
          <Botao variante="secundario" tamanho="pequeno" onClick={() => {
            if (!quotaCheia) setConsultasAntes(atual.consultasNoMes);
            salvarParametros({ ...atual, consultasNoMes: quotaCheia ? (consultasAntes ?? Math.round(limite * 0.7)) : limite }, quotaCheia ? "Limite de consultas restaurado." : "Simulação ligada: limite mensal atingido.");
          }}>
            {quotaCheia ? "Restaurar o limite de consultas" : "Simular limite de consultas atingido"}
          </Botao>
          <Botao variante="secundario" tamanho="pequeno" onClick={() => salvarParametros({ ...atual, token: atual.token ? "" : TOKEN_DEMO }, atual.token ? "Simulação ligada: sem chave de acesso." : "Chave de acesso restaurada.")}>
            {atual.token ? "Simular chave de acesso ausente" : "Restaurar a chave de acesso"}
          </Botao>
        </div>
        <div style={{ ...cardStyle, marginTop: 12 }}>
          <div style={{ fontSize: 13.5, color: tema.ink, lineHeight: 1.6 }}>
            Este protótipo guarda tudo neste navegador: {estado.clientes.length.toLocaleString("pt-BR")} clientes simulados, envios, consultas e histórico. Reiniciar volta ao ponto de partida (envio do mês aguardando correções).
          </div>
          {!confirmar ? (
            <div style={{ marginTop: 12 }}>
              <Botao variante="perigo" onClick={() => setConfirmar(true)}>Reiniciar demonstração</Botao>
            </div>
          ) : (
            <>
              <Aviso tipo="aviso">Isso apaga as correções, envios e consultas feitas nesta demonstração. Confirmar?</Aviso>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Botao variante="perigo" onClick={() => { reiniciar(); setConfirmar(false); }}>Sim, reiniciar</Botao>
                <Botao variante="secundario" onClick={() => setConfirmar(false)}>Cancelar</Botao>
              </div>
            </>
          )}
        </div>
      </Section>

      <Section titulo="Ajuda">
        <details style={{ ...cardStyle, marginBottom: 10 }}>
          <summary style={resumo}>O que trava o envio e o que é só aviso</summary>
          <div className="gridDuo" style={{ marginTop: 12 }}>
            <div>
              <div style={{ fontWeight: 800, color: tema.danger, marginBottom: 6 }}>Trava (precisa corrigir ou tirar do envio)</div>
              {TRAVAS.map((t) => <p key={t[0]} style={par}><b>{t[0]}.</b> {t[1]}</p>)}
            </div>
            <div>
              <div style={{ fontWeight: 800, color: tema.amber, marginBottom: 6 }}>Aviso (segue no envio)</div>
              {AVISOS.map((t) => <p key={t[0]} style={par}><b>{t[0]}.</b> {t[1]}</p>)}
            </div>
          </div>
        </details>
        <details style={{ ...cardStyle, marginBottom: 10 }}>
          <summary style={resumo}>Como é o arquivo enviado à Credinfar (INFASSOC.SIC)</summary>
          <div style={{ fontSize: 13, color: tema.muted, margin: "10px 0" }}>Uma linha de 270 posições por cliente. Datas no formato mês e ano (MMAAAA), valores inteiros sem centavos, nada em branco na identificação nem a partir da posição 121.</div>
          <Tabela
            colunas={[
              { titulo: "Campo", valor: (c) => <b>{c.descricao}</b> },
              { titulo: "Posições", valor: (c) => `${String(c.inicio).padStart(3, "0")} a ${String(c.fim).padStart(3, "0")}` },
              { titulo: "Tamanho", valor: (c) => String(c.tamanho), alinhar: "right" },
              { titulo: "Tipo", valor: (c) => c.tipo },
            ]}
            linhas={LAYOUT}
            chave={(c) => c.nome}
          />
        </details>
        <details style={{ ...cardStyle, marginBottom: 10 }}>
          <summary style={resumo}>O que ainda precisa ser confirmado com a Credinfar</summary>
          <div style={{ marginTop: 10 }}>{CONFIRMAR.map((t) => <p key={t[0]} style={par}><b>{t[0]}.</b> {t[1]}</p>)}</div>
        </details>
        <details style={cardStyle}>
          <summary style={resumo}>Acesso à API (para a TI)</summary>
          <div className="gridFicha" style={{ marginTop: 6 }}>
            <Campo rotulo="Usuário (Login)"><input value={p.login} onChange={(e) => set("login", e.target.value)} style={inputStyle} /></Campo>
            <Campo rotulo="Chave de acesso (token)"><input value={p.token} onChange={(e) => set("token", e.target.value)} style={inputStyle} /></Campo>
            <Campo rotulo="IP cadastrado na Credinfar"><input value={p.ipCadastrado} onChange={(e) => set("ipCadastrado", e.target.value)} style={inputStyle} /></Campo>
            <Campo rotulo="IP de saída"><input value={p.ipSaida} onChange={(e) => set("ipSaida", e.target.value)} style={inputStyle} /></Campo>
            <Campo rotulo="Endereço de homologação"><input value={p.endpointHomologacao} onChange={(e) => set("endpointHomologacao", e.target.value)} style={inputStyle} /></Campo>
          </div>
          <div style={{ marginTop: 12 }}>
            <Botao variante="secundario" tamanho="pequeno" onClick={() => salvarParametros(p)}>Gravar acesso</Botao>
          </div>
        </details>
      </Section>
    </>
  );
}

const resumo = { cursor: "pointer", fontWeight: 700, color: tema.blueDark, fontSize: 14 } as const;
const par = { fontSize: 13.5, lineHeight: 1.6, margin: "0 0 8px", color: tema.ink } as const;
