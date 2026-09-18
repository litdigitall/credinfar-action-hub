// Credinfar Action Hub: do dado à decisão.
//   Hoje        → lista curta de decisões (risco, cobrança, vender mais), priorizada por valor
//   Clientes    → posição conosco x mercado, com as ações no mesmo lugar
//   Envio do mês → receber a carteira, corrigir o que travou, enviar
//   Histórico   → envios, consultas e quem decidiu o quê
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Icon } from "@tabler/icons-react";
import { IconHistory, IconInbox, IconMenu2, IconSearch, IconSend, IconSettings, IconShieldCheck } from "@tabler/icons-react";
import type { Cliente, DecisaoAcao, EstadoHub, OpcaoAcao, Parametros, Remessa } from "./models/types";
import type { RespostaCredinfar } from "./engine/credinfarMock";
import type { ExtrasDecisao } from "./services/estado";
import {
  atualizarCarteira,
  atualizarParametros,
  carregarEstado,
  consultar,
  enviarTudo,
  liberarCliente,
  metricas as calcularMetricas,
  receberRemessa,
  registrarDecisao,
  reiniciarEstado,
  remessaCorrente,
  resolverAcao,
  salvarEstado,
} from "./services/estado";
import { usePowerPlatform, usuarioAtual } from "./services/PowerProvider";
import { tema } from "./theme/tema";
import { Envio } from "./screens/Envio";
import { Hoje } from "./screens/Hoje";
import { Clientes } from "./screens/Clientes";
import { Historico } from "./screens/Historico";
import { Configuracoes } from "./screens/Configuracoes";

export type Aba = "hoje" | "clientes" | "envio" | "historico" | "config";
const TITULOS: Record<Aba, string> = {
  hoje: "Hoje",
  clientes: "Clientes",
  envio: "Envio do mês",
  historico: "Histórico",
  config: "Configurações",
};

export interface AvisoUi {
  tipo: "ok" | "erro" | "aviso";
  texto: string;
}

export interface Hub {
  estado: EstadoHub;
  usuario: string;
  aba: Aba;
  setAba: (a: Aba) => void;
  avisar: (tipo: AvisoUi["tipo"], texto: string) => void;
  metricas: ReturnType<typeof calcularMetricas>;
  remessaAtual: Remessa | undefined;
  clienteFoco: string | null; // cliente aberto na Consulta (mantido ao trocar de tela)
  focarCliente: (id: string | null) => void;
  verCliente: (id: string) => void; // foca o cliente e abre a tela Clientes
  decidir: (clienteId: string, opcao: OpcaoAcao, extras: ExtrasDecisao) => void;
  liberar: (clienteId: string) => void;
  atualizarLeitura: () => void;
  receber: (origem: "ERP" | "Arquivo", clientes?: Cliente[]) => void;
  resolver: (acaoId: string, decisao: DecisaoAcao, justificativa: string, alteracoes: Record<string, number | string>) => void;
  enviar: (remessaId: string) => void;
  consultarCredinfar: (cnpjRaiz: string) => RespostaCredinfar;
  salvarParametros: (p: Parametros, mensagem?: string) => void;
  reiniciar: () => void;
}

const Ctx = createContext<Hub | null>(null);
export function useHub(): Hub {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHub fora do provider");
  return v;
}

export function App() {
  const pronto = usePowerPlatform();
  const [estado, setEstado] = useState<EstadoHub | null>(null);
  const [aba, setAba] = useState<Aba>("hoje");
  const [menuAberto, setMenuAberto] = useState(false);
  const [aviso, setAviso] = useState<AvisoUi | null>(null);
  const [clienteFoco, setClienteFoco] = useState<string | null>(null);
  const primeiraGravacao = useRef(true);
  const usuario = usuarioAtual.nome;

  useEffect(() => {
    if (pronto) setEstado(carregarEstado());
  }, [pronto]);

  // O protótipo guarda tudo no navegador de quem usa
  useEffect(() => {
    if (!estado) return;
    if (primeiraGravacao.current) {
      primeiraGravacao.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (!salvarEstado(estado)) setAviso({ tipo: "aviso", texto: "Não foi possível guardar os dados neste navegador (armazenamento cheio ou bloqueado)." });
    }, 150);
    return () => clearTimeout(t);
  }, [estado]);

  useEffect(() => {
    if (!aviso || aviso.tipo === "erro") return;
    const t = setTimeout(() => setAviso(null), 7000);
    return () => clearTimeout(t);
  }, [aviso]);

  const avisar = useCallback((tipo: AvisoUi["tipo"], texto: string) => setAviso({ tipo, texto }), []);

  const receber = useCallback(
    (origem: "ERP" | "Arquivo", clientes?: Cliente[]) => {
      if (!estado) return;
      const { estado: novo, remessa } = receberRemessa(estado, origem, usuario, clientes);
      setEstado(novo);
      setAviso({
        tipo: remessa.bloqueados > 0 ? "aviso" : "ok",
        texto:
          remessa.bloqueados > 0
            ? `Carteira recebida: ${remessa.registros.toLocaleString("pt-BR")} clientes. ${remessa.bloqueados} precisam de correção antes do envio.`
            : `Carteira recebida: ${remessa.registros.toLocaleString("pt-BR")} clientes, nenhum travado. Já pode enviar.`,
      });
      setAba("envio");
    },
    [estado, usuario]
  );
  const resolver = useCallback(
    (acaoId: string, decisao: DecisaoAcao, justificativa: string, alteracoes: Record<string, number | string>) => {
      setEstado((e) => (e ? resolverAcao(e, acaoId, decisao, justificativa, alteracoes, usuario) : e));
    },
    [usuario]
  );
  const enviar = useCallback(
    (remessaId: string) => {
      if (!estado) return;
      const r = enviarTudo(estado, remessaId, usuario);
      setEstado(r.estado);
      setAviso(r.erro ? { tipo: "erro", texto: r.erro } : { tipo: "ok", texto: "Arquivo gerado e enviado à Credinfar." });
    },
    [estado, usuario]
  );
  const consultarCredinfar = useCallback(
    (cnpjRaiz: string): RespostaCredinfar => {
      const { estado: novo, resposta } = consultar(estado!, cnpjRaiz, usuario);
      setEstado(novo);
      return resposta;
    },
    [estado, usuario]
  );
  const salvarParametros = useCallback(
    (p: Parametros, mensagem = "Configurações gravadas.") => {
      setEstado((e) => (e ? atualizarParametros(e, p, usuario) : e));
      setAviso({ tipo: "ok", texto: mensagem });
    },
    [usuario]
  );
  const decidir = useCallback(
    (clienteId: string, opcao: OpcaoAcao, extras: ExtrasDecisao) => {
      setEstado((e) => (e ? registrarDecisao(e, clienteId, opcao, extras, usuario) : e));
      setAviso({ tipo: "ok", texto: "Decisão registrada. Ela fica no histórico com o seu nome." });
    },
    [usuario]
  );
  const liberar = useCallback(
    (clienteId: string) => {
      setEstado((e) => (e ? liberarCliente(e, clienteId, usuario) : e));
      setAviso({ tipo: "ok", texto: "Vendas a prazo liberadas novamente." });
    },
    [usuario]
  );
  const atualizarLeitura = useCallback(() => {
    if (!estado) return;
    const r = atualizarCarteira(estado, usuario);
    setEstado(r.estado);
    setAviso(r.erro ? { tipo: "erro", texto: r.erro } : { tipo: "ok", texto: r.consultados === 0 ? "Sem consultas disponíveis neste mês para uma nova leitura. A lista atual continua valendo." : `Carteira atualizada: ${r.consultados.toLocaleString("pt-BR")} clientes consultados, ${r.novos} pedem decisão.` });
  }, [estado, usuario]);
  const reiniciar = useCallback(() => {
    setEstado(reiniciarEstado());
    setClienteFoco(null);
    setAba("hoje");
    setAviso({ tipo: "ok", texto: "Demonstração reiniciada com a carteira original." });
  }, []);
  const verCliente = useCallback((id: string) => {
    setClienteFoco(id);
    setAba("clientes");
  }, []);

  const hub = useMemo<Hub | null>(
    () =>
      estado
        ? { estado, usuario, aba, setAba, avisar, metricas: calcularMetricas(estado), remessaAtual: remessaCorrente(estado), clienteFoco, focarCliente: setClienteFoco, verCliente, decidir, liberar, atualizarLeitura, receber, resolver, enviar, consultarCredinfar, salvarParametros, reiniciar }
        : null,
    [estado, usuario, aba, avisar, clienteFoco, verCliente, decidir, liberar, atualizarLeitura, receber, resolver, enviar, consultarCredinfar, salvarParametros, reiniciar]
  );

  if (!hub || !estado) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: tema.bg }}>
        <div style={{ fontWeight: 800, color: tema.heading, fontSize: 18 }}>Credinfar Action Hub</div>
      </div>
    );
  }

  return (
    <Ctx.Provider value={hub}>
      <div className="layout">
        <Sidebar
          aba={aba}
          aberto={menuAberto}
          travados={hub.metricas.bloqueios}
          onMudar={(a) => {
            setAba(a);
            setMenuAberto(false);
          }}
        />
        {menuAberto && <div className="scrim" onClick={() => setMenuAberto(false)} />}
        <div className="mainCol">
          <TopBar aba={aba} onMenu={() => setMenuAberto((v) => !v)} />
          {aviso && (
            <div role="status" style={{ margin: "12px 20px 0", padding: "10px 14px", borderRadius: 10, fontSize: 13.5, background: aviso.tipo === "ok" ? tema.okBg : aviso.tipo === "erro" ? tema.dangerBg : tema.amberBg, color: aviso.tipo === "ok" ? tema.ok : aviso.tipo === "erro" ? tema.danger : tema.amber, display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>{aviso.texto}</span>
              <button onClick={() => setAviso(null)} aria-label="Fechar aviso" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}>
                ✕
              </button>
            </div>
          )}
          <main className="content">
            {aba === "hoje" && <Hoje />}
            {aba === "clientes" && <Clientes />}
            {aba === "envio" && <Envio />}
            {aba === "historico" && <Historico />}
            {aba === "config" && <Configuracoes />}
          </main>
        </div>
      </div>
    </Ctx.Provider>
  );
}

// ---------------------------------------------------------------------------
function Sidebar({ aba, aberto, onMudar, travados }: { aba: Aba; aberto: boolean; onMudar: (a: Aba) => void; travados: number }) {
  return (
    <aside className={`sidebar${aberto ? " open" : ""}`} style={{ background: tema.sidebarGradient }}>
      <div style={{ padding: "4px 4px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 10 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.18)" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: tema.brandGradient, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <IconShieldCheck size={20} />
          </span>
          <span style={{ fontWeight: 800, color: tema.navy, fontSize: 15, letterSpacing: "-0.3px" }}>CFS Navigator</span>
        </div>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", textAlign: "center", marginTop: 14, lineHeight: 1.1 }}>Credinfar Action Hub</div>
        <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.4px", textAlign: "center", marginTop: 4 }}>Crédito e Cobrança · By CFS Navigator</div>
      </div>

      <div style={navSectionStyle}>O que você quer fazer</div>
      <NavItem icone={IconInbox} rotulo="Hoje" ativa={aba === "hoje"} onClick={() => onMudar("hoje")} />
      <NavItem icone={IconSearch} rotulo="Clientes" ativa={aba === "clientes"} onClick={() => onMudar("clientes")} />
      <NavItem icone={IconSend} rotulo="Envio do mês" ativa={aba === "envio"} badge={travados} onClick={() => onMudar("envio")} />
      <NavItem icone={IconHistory} rotulo="Histórico" ativa={aba === "historico"} onClick={() => onMudar("historico")} />

      <div style={{ marginTop: "auto" }}>
        <NavItem icone={IconSettings} rotulo="Configurações" ativa={aba === "config"} onClick={() => onMudar("config")} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 10px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", marginTop: 8 }}>
          <Avatar tamanho={40} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{usuarioAtual.nome}</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Crédito e Cobrança</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icone: Icone, rotulo, ativa, badge, onClick }: { icone: Icon; rotulo: string; ativa: boolean; badge?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={ativa ? "page" : undefined}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 9, border: "none", background: ativa ? "#fff" : "transparent", color: ativa ? tema.blueDark : "rgba(255,255,255,0.78)", fontSize: 14.5, fontWeight: ativa ? 700 : 500, cursor: "pointer", textAlign: "left", width: "100%" }}
    >
      <Icone size={20} stroke={1.7} />
      <span style={{ flex: 1 }}>{rotulo}</span>
      {(badge ?? 0) > 0 && <span style={{ background: tema.danger, color: "#fff", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "1px 8px" }}>{badge}</span>}
    </button>
  );
}

function TopBar({ aba, onMenu }: { aba: Aba; onMenu: () => void }) {
  const { estado } = useHub();
  return (
    <header style={{ minHeight: 62, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${tema.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 20px", position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <button className="burger" onClick={onMenu} aria-label="Menu" style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${tema.line}`, background: tema.surface, cursor: "pointer", alignItems: "center", justifyContent: "center", color: tema.ink }}>
          <IconMenu2 size={18} />
        </button>
        <div style={{ fontSize: 18, fontWeight: 800, color: tema.heading, whiteSpace: "nowrap" }}>{TITULOS[aba]}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={chip}>Mês {estado.parametros.competencia}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, background: tema.amberBg, color: tema.amber, borderRadius: 999, padding: "3px 10px" }}>PROTÓTIPO · DADOS SIMULADOS</span>
        <div className="usuarioTopo" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar tamanho={34} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: tema.heading }}>{usuarioAtual.nome}</div>
            <div style={{ fontSize: 11.5, color: tema.muted }}>{usuarioAtual.email || estado.parametros.nomeAssociada}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

function Avatar({ tamanho }: { tamanho: number }) {
  return (
    <div style={{ width: tamanho, height: tamanho, borderRadius: "50%", background: tema.avatarGradient, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: tamanho * 0.38, fontWeight: 700, flexShrink: 0 }}>
      {iniciais(usuarioAtual.nome)}
    </div>
  );
}

const navSectionStyle: CSSProperties = { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", padding: "14px 12px 6px" };
const chip: CSSProperties = { border: `1px solid ${tema.line}`, borderRadius: 999, padding: "6px 12px", fontSize: 13, background: tema.surface, color: tema.heading, fontWeight: 600 };
