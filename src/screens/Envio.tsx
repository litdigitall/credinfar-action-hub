// Envio do mês: uma tela, três passos.
//   1. Receber a carteira   2. Corrigir o que travou   3. Enviar à Credinfar
// Só aparece o que impede o envio. Cada cliente travado tem duas saídas:
// Corrigir ou Tirar do envio. Os avisos são informativos, sem decisão.
import { useMemo, useRef, useState } from "react";
import { IconCircleCheck, IconDownload, IconFileTypeTxt, IconSend, IconUpload } from "@tabler/icons-react";
import { useHub } from "../App";
import { Botao } from "../components/Botao";
import { Aviso, Campo, Codigo, Modal, inputStyle } from "../components/ui";
import { Section, brlExec, fmtDataHora, fmtInt } from "../components/visual";
import { decomporLinha } from "../engine/infassoc";
import { brlInt, cnpjValido, formatarCnpj, soDigitos } from "../engine/util";
import { lerCarteiraCsv, MODELO_CSV } from "../services/arquivoCarteira";
import { conteudoArquivo, statusSimples } from "../services/estado";
import type { Acao, Cliente, CodigoAcao } from "../models/types";
import { tema } from "../theme/tema";

const ROTULO_AVISO: Partial<Record<CodigoAcao, string>> = {
  EXPOSICAO_ACIMA_LIMITE: "Débito acima do limite",
  LIMITE_PROXIMO: "Perto do limite",
  VENCIDOS_ACIMA_90: "Vencidos há mais de 90 dias",
  SEM_MOVIMENTACAO: "Sem compra há 6 meses",
};

export function Envio() {
  const { estado, remessaAtual: r, metricas: m, receber, resolver, enviar, verCliente, avisar } = useHub();
  const [corrigindo, setCorrigindo] = useState<Acao | null>(null);
  const [tirando, setTirando] = useState<Acao | null>(null);
  const [avisoAberto, setAvisoAberto] = useState<CodigoAcao | null>(null);
  const [previa, setPrevia] = useState(false);
  const [campos, setCampos] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const clientes = useMemo(() => new Map(estado.clientes.map((c) => [c.id, c])), [estado.clientes]);
  const pendentes = useMemo(() => (r ? estado.acoes.filter((a) => a.remessaId === r.id && a.status === "PENDING" && !r.excluidos.includes(a.clienteId)) : []), [estado.acoes, r]);
  const travados = pendentes.filter((a) => a.tipo === "BLOCKER");
  const avisos = pendentes.filter((a) => a.tipo !== "BLOCKER");
  const situacao = r ? statusSimples(r) : null;
  const passo = !r || situacao === "Enviada" ? (situacao === "Enviada" ? 4 : 1) : travados.length > 0 ? 2 : 3;
  const noEnvio = r ? r.registros - r.excluidos.length : 0;
  const conteudo = useMemo(() => (r && (previa || situacao === "Enviada") ? conteudoArquivo(estado, r.id) : ""), [estado, r, previa, situacao]);
  const linhas = conteudo ? conteudo.split("\r\n").filter(Boolean).slice(0, 3) : [];

  const baixar = (texto: string, nome: string, tipo: string) => {
    try {
      const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      avisar("aviso", "O navegador bloqueou o download.");
    }
  };

  const aoEscolherArquivo = async (f: File | undefined) => {
    if (!f) return;
    const lido = lerCarteiraCsv(await f.text());
    if (inputRef.current) inputRef.current.value = "";
    if (lido.clientes.length === 0) {
      avisar("erro", lido.avisos[0] ?? "Nenhum cliente válido no arquivo.");
      return;
    }
    receber("Arquivo", lido.clientes);
  };

  return (
    <>
      <div className="card anim-subir" style={{ marginBottom: 18 }}>
        <Passos atual={passo} />
      </div>

      {r && passo !== 4 && (
        <p className="lead anim-subir" style={{ margin: "0 2px 18px", color: tema.ink }}>
          <b>{fmtInt(noEnvio)} clientes</b> neste envio, {brlExec(m.carteira)} de débito informado.{" "}
          {travados.length > 0 ? <b style={{ color: tema.danger }}>{fmtInt(travados.length)} travado(s).</b> : <b style={{ color: tema.ok }}>Nada impede o envio.</b>}
          {r.excluidos.length > 0 ? ` ${fmtInt(r.excluidos.length)} tirado(s) deste envio.` : ""}
        </p>
      )}

      {/* ------------------------------------------------ Passo 1 / concluído */}
      {(passo === 1 || passo === 4) && (
        <Section titulo={passo === 4 ? "Envio concluído" : "1. Receber a carteira do mês"}>
          {passo === 4 && r && (
            <div className="hero" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 800 }}>
                <IconCircleCheck size={26} /> Enviado à Credinfar
              </div>
              <div style={{ fontSize: 14.5, opacity: 0.92, marginTop: 8, lineHeight: 1.7, maxWidth: 720 }}>
                {fmtInt(r.arquivo?.registros ?? 0)} clientes enviados em {fmtDataHora(r.enviadaEm ?? "")} por {r.enviadaPor}. Protocolo <b>{r.protocolo}</b>.<br />
                No próximo mês você poderá fazer até <b>{fmtInt(Math.floor((r.arquivo?.registros ?? 0) * 1.5))}</b> consultas à Credinfar (1,5 vez o que foi enviado).
              </div>
              <div style={{ marginTop: 14 }}>
                <Botao variante="claro" tamanho="pequeno" icone={<IconDownload size={15} />} onClick={() => baixar(conteudo, "INFASSOC.SIC", "text/plain")}>
                  Baixar o arquivo enviado
                </Botao>
              </div>
            </div>
          )}
          <div className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Botao icone={<IconUpload size={16} />} onClick={() => receber("ERP")}>
              {passo === 4 ? "Receber a carteira do próximo envio" : "Receber a carteira do ERP"}
            </Botao>
            <Botao variante="secundario" icone={<IconFileTypeTxt size={16} />} onClick={() => inputRef.current?.click()}>
              Importar arquivo (CSV)
            </Botao>
            <input ref={inputRef} type="file" accept=".csv,.txt" hidden onChange={(e) => void aoEscolherArquivo(e.target.files?.[0])} aria-label="Arquivo de carteira" />
            <Botao variante="link" onClick={() => baixar("﻿" + MODELO_CSV, "modelo-carteira-credinfar.csv", "text/csv;charset=utf-8")}>
              Baixar o modelo do arquivo
            </Botao>
          </div>
        </Section>
      )}

      {/* ------------------------------------------------ Passo 2 */}
      {r && passo === 2 && (
        <Section titulo={`2. Corrigir o que travou (${fmtInt(travados.length)})`} sub="Estes clientes não cabem no arquivo da Credinfar do jeito que vieram. Corrija ou tire do envio. O resto da carteira já está pronto.">
          <div className="gridAcoes anim-lista">
            {travados.map((a) => {
              const c = clientes.get(a.clienteId);
              return (
                <article key={a.id} data-testid="travado" className="card card-hover" style={{ borderLeft: `5px solid ${tema.danger}`, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, color: tema.heading, fontSize: 15.5, letterSpacing: "-0.01em" }}>{c?.nome || "(sem razão social)"}</div>
                    <div style={{ fontSize: 12, color: tema.muted, marginTop: 2 }}>{c ? `${formatarCnpj(c.cnpj)} · ${c.cidade || "?"}/${c.uf || "?"}` : ""}</div>
                  </div>
                  <div style={{ fontSize: 13.5, color: tema.ink, lineHeight: 1.55 }}>
                    <b>{a.mensagem}.</b> {a.detalhe}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    <Botao tamanho="pequeno" onClick={() => setCorrigindo(a)}>Corrigir</Botao>
                    <Botao variante="secundario" tamanho="pequeno" onClick={() => setTirando(a)}>Tirar do envio</Botao>
                  </div>
                </article>
              );
            })}
          </div>
        </Section>
      )}

      {/* ------------------------------------------------ Passo 3 */}
      {r && passo === 3 && (
        <Section titulo="3. Enviar à Credinfar">
          <div className="hero">
            <div className="kicker" style={{ color: "rgba(255,255,255,0.75)" }}>Tudo conferido</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 4 }}>Tudo pronto para enviar</div>
            <div style={{ fontSize: 14.5, opacity: 0.92, marginTop: 8, lineHeight: 1.7, maxWidth: 720 }}>
              {fmtInt(noEnvio)} clientes, {brlInt(m.carteira)} de débito e {brlInt(m.vencido)} vencidos. O app monta o arquivo no layout oficial da Credinfar (270 posições por cliente), confere linha por linha e registra o envio.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, alignItems: "center" }}>
              <Botao icone={<IconSend size={16} />} onClick={() => enviar(r.id)} style={{ boxShadow: "0 10px 26px rgba(0,0,0,0.25)" }}>Gerar arquivo e enviar</Botao>
              <Botao variante="claro" onClick={() => setPrevia((v) => !v)}>{previa ? "Ocultar o arquivo" : "Ver o arquivo antes"}</Botao>
              {previa && (
                <Botao variante="claro" icone={<IconDownload size={15} />} onClick={() => baixar(conteudo, "INFASSOC.SIC", "text/plain")}>
                  Baixar
                </Botao>
              )}
            </div>
          </div>
          {previa && linhas.length > 0 && (
            <div className="card anim-subir" style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <div style={{ fontWeight: 800, color: tema.heading }}>INFASSOC.SIC · {fmtInt(noEnvio)} linhas de 270 posições (primeiras 3)</div>
                <Botao variante="link" tamanho="pequeno" onClick={() => setCampos((v) => !v)}>{campos ? "Ocultar os campos" : "Entender os campos da 1ª linha"}</Botao>
              </div>
              <Codigo altura={140}>{linhas.join("\n")}</Codigo>
              {campos && (
                <div style={{ marginTop: 12, overflowX: "auto" }}>
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Campo</th><th>Posições</th><th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decomporLinha(linhas[0]).map(({ campo, valor }) => (
                        <tr key={campo.nome} className="linhaFixa">
                          <td><b>{campo.descricao}</b></td>
                          <td className="num">{String(campo.inicio).padStart(3, "0")} a {String(campo.fim).padStart(3, "0")}</td>
                          <td style={{ fontFamily: tema.mono }}>{valor.trim() || "(vazio)"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Section>
      )}

      {/* ------------------------------------------------ Avisos (informativos) */}
      {r && passo !== 4 && avisos.length > 0 && (
        <details className="card" style={{ marginTop: 6 }}>
          <summary style={{ fontWeight: 700, color: tema.blueDark }}>{fmtInt(avisos.length)} avisos, só para conhecimento</summary>
          <div style={{ fontSize: 13, color: tema.muted, margin: "10px 0 12px" }}>Não impedem o envio. Servem para você saber o que está indo para a Credinfar.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(Object.keys(ROTULO_AVISO) as CodigoAcao[]).map((cod) => {
              const n = avisos.filter((a) => a.codigo === cod).length;
              if (n === 0) return null;
              return (
                <button key={cod} className="pill" aria-pressed={avisoAberto === cod} onClick={() => setAvisoAberto(avisoAberto === cod ? null : cod)}>
                  {ROTULO_AVISO[cod]} <span className="n">{fmtInt(n)}</span>
                </button>
              );
            })}
          </div>
          {avisoAberto && (
            <div style={{ marginTop: 12, border: `1px solid ${tema.line}`, borderRadius: 12, overflow: "hidden" }}>
              {avisos.filter((a) => a.codigo === avisoAberto).slice(0, 40).map((a) => {
                const c = clientes.get(a.clienteId);
                return (
                  <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${tema.line}`, fontSize: 13, flexWrap: "wrap" }}>
                    <button onClick={() => verCliente(a.clienteId)} className="btn btn-link btn-sm" style={{ padding: 0, fontWeight: 700 }}>{c?.nome ?? a.clienteId}</button>
                    <span style={{ color: tema.muted, flex: 1, minWidth: 200 }}>{a.detalhe}</span>
                    <Botao variante="ghost" tamanho="pequeno" onClick={() => setTirando(a)}>Tirar do envio</Botao>
                  </div>
                );
              })}
              {avisos.filter((a) => a.codigo === avisoAberto).length > 40 && <div style={{ padding: "8px 14px", fontSize: 12.5, color: tema.muted }}>Mostrando os 40 primeiros.</div>}
            </div>
          )}
        </details>
      )}

      {corrigindo && clientes.get(corrigindo.clienteId) && (
        <ModalCorrigir
          acao={corrigindo}
          cliente={clientes.get(corrigindo.clienteId)!}
          onFechar={() => setCorrigindo(null)}
          onConfirmar={(decisao, alteracoes, obs) => {
            resolver(corrigindo.id, decisao, obs || "Corrigido pelo analista na preparação do envio.", alteracoes);
            avisar("ok", "Correção gravada. O cliente volta para o envio.");
            setCorrigindo(null);
          }}
        />
      )}
      {tirando && (
        <ModalTirar
          nome={clientes.get(tirando.clienteId)?.nome ?? tirando.clienteId}
          onFechar={() => setTirando(null)}
          onConfirmar={(motivo) => {
            resolver(tirando.id, tirando.tipo === "BLOCKER" ? "EXCLUIR_DA_REMESSA" : "RETIRAR_DA_REMESSA", motivo || "Tirado do envio pelo analista.", {});
            avisar("ok", "Cliente tirado deste envio. Ele volta na carteira do próximo mês.");
            setTirando(null);
          }}
        />
      )}
    </>
  );
}

// Três passos, sem siglas
function Passos({ atual }: { atual: number }) {
  const passos = ["Receber a carteira", "Corrigir o que travou", "Enviar à Credinfar"];
  return (
    <ol className="passos" aria-label="Passos do envio">
      {passos.map((p, i) => {
        const n = i + 1;
        const estado = atual > n ? "feito" : atual === n ? "ativo" : "futuro";
        return (
          <li key={p} data-estado={estado} aria-current={estado === "ativo" ? "step" : undefined}>
            <span className="bolha">{estado === "feito" ? "✓" : n}</span>
            <span className="rotulo">{p}</span>
            {n < 3 && <span className="traco" />}
          </li>
        );
      })}
    </ol>
  );
}

// Correção conforme o problema: documento, cadastro, faixas de vencidos ou valores.
function ModalCorrigir({ acao, cliente: c, onFechar, onConfirmar }: { acao: Acao; cliente: Cliente; onFechar: () => void; onConfirmar: (decisao: "CORRIGIR_DOCUMENTO" | "CORRIGIR_VALORES" | "ACEITAR_ORIGEM", alteracoes: Record<string, number | string>, obs: string) => void }) {
  const [cnpj, setCnpj] = useState(c.cnpj);
  const [cad, setCad] = useState({ nome: c.nome, endereco: c.endereco, cidade: c.cidade, cep: c.cep, uf: c.uf });
  const [faixas, setFaixas] = useState({ ...c.vencidos });
  const [vencido, setVencido] = useState(c.debitoVencido);
  const [valores, setValores] = useState({ limite: c.limite, debitoAtual: c.debitoAtual });
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const num = (v: string) => Math.max(0, Math.round(Number(v.replace(/\D/g, "")) || 0));
  const soma = faixas.d01 + faixas.d11 + faixas.d31 + faixas.d91 + faixas.d181 + faixas.d361;

  const gravar = () => {
    if (acao.codigo === "CNPJ_INVALIDO") {
      if (!cnpjValido(cnpj)) return setErro("Este CNPJ ainda não é válido. Confira os 14 dígitos.");
      return onConfirmar("CORRIGIR_DOCUMENTO", { cnpj: soDigitos(cnpj) }, obs);
    }
    if (acao.codigo === "CADASTRO_INCOMPLETO") {
      if (!cad.nome.trim() || !cad.endereco.trim() || !cad.cidade.trim() || soDigitos(cad.cep).length !== 8 || !/^[A-Za-z]{2}$/.test(cad.uf)) return setErro("Preencha razão social, endereço, cidade, CEP com 8 dígitos e UF com 2 letras.");
      return onConfirmar("CORRIGIR_DOCUMENTO", { ...cad, cep: soDigitos(cad.cep) }, obs);
    }
    if (acao.codigo === "AGING_MISMATCH") {
      if (soma !== vencido) return setErro(`As faixas somam ${brlInt(soma)} e o vencido é ${brlInt(vencido)}. Ajuste até fechar ou use o valor do ERP.`);
      return onConfirmar("CORRIGIR_VALORES", { ...faixas, debitoVencido: vencido }, obs);
    }
    return onConfirmar("CORRIGIR_VALORES", { ...valores }, obs);
  };

  return (
    <Modal titulo={`Corrigir · ${c.nome || formatarCnpj(c.cnpj)}`} aberto onFechar={onFechar}>
      <div style={{ fontSize: 13.5, color: tema.ink, lineHeight: 1.55 }}>
        <b>{acao.mensagem}.</b> {acao.detalhe}
      </div>

      {acao.codigo === "CNPJ_INVALIDO" && (
        <Campo rotulo="CNPJ correto (14 dígitos)" ajuda={cnpjValido(cnpj) ? "CNPJ válido." : "Os dois últimos dígitos não conferem."}>
          <input value={cnpj} onChange={(e) => { setCnpj(e.target.value); setErro(null); }} style={{ ...inputStyle, fontSize: 16, fontWeight: 700, fontFamily: tema.mono }} aria-label="CNPJ correto" />
        </Campo>
      )}
      {acao.codigo === "CADASTRO_INCOMPLETO" && (
        <div className="gridFicha">
          <Campo rotulo="Razão social"><input value={cad.nome} onChange={(e) => setCad({ ...cad, nome: e.target.value })} style={inputStyle} /></Campo>
          <Campo rotulo="Endereço"><input value={cad.endereco} onChange={(e) => setCad({ ...cad, endereco: e.target.value })} style={inputStyle} /></Campo>
          <Campo rotulo="Cidade"><input value={cad.cidade} onChange={(e) => setCad({ ...cad, cidade: e.target.value })} style={inputStyle} /></Campo>
          <Campo rotulo="CEP"><input value={cad.cep} onChange={(e) => setCad({ ...cad, cep: e.target.value })} style={inputStyle} aria-label="CEP" /></Campo>
          <Campo rotulo="UF"><input value={cad.uf} onChange={(e) => setCad({ ...cad, uf: e.target.value.toUpperCase().slice(0, 2) })} style={inputStyle} aria-label="UF" /></Campo>
        </div>
      )}
      {acao.codigo === "AGING_MISMATCH" && (
        <>
          <div className="gridFicha">
            {(["d01", "d11", "d31", "d91", "d181", "d361"] as const).map((k) => (
              <Campo key={k} rotulo={{ d01: "1 a 10 dias", d11: "11 a 30 dias", d31: "31 a 90 dias", d91: "91 a 180 dias", d181: "181 a 360 dias", d361: "mais de 360 dias" }[k]}>
                <input value={faixas[k]} onChange={(e) => { setFaixas({ ...faixas, [k]: num(e.target.value) }); setErro(null); }} style={inputStyle} inputMode="numeric" />
              </Campo>
            ))}
            <Campo rotulo="Total vencido"><input value={vencido} onChange={(e) => { setVencido(num(e.target.value)); setErro(null); }} style={inputStyle} inputMode="numeric" /></Campo>
          </div>
          <div style={{ marginTop: 10, fontSize: 13.5, color: soma === vencido ? tema.ok : tema.danger, fontWeight: 600 }}>
            As faixas somam {brlInt(soma)} e o total vencido é {brlInt(vencido)}{soma === vencido ? ". Fechou." : `. Falta ${brlInt(vencido - soma)}.`}
          </div>
        </>
      )}
      {acao.codigo === "VALOR_FORA_DO_LAYOUT" && (
        <div className="gridFicha">
          <Campo rotulo="Limite de crédito"><input value={valores.limite} onChange={(e) => setValores({ ...valores, limite: num(e.target.value) })} style={inputStyle} inputMode="numeric" /></Campo>
          <Campo rotulo="Débito atual"><input value={valores.debitoAtual} onChange={(e) => setValores({ ...valores, debitoAtual: num(e.target.value) })} style={inputStyle} inputMode="numeric" /></Campo>
        </div>
      )}

      <Campo rotulo="Observação (opcional, fica no histórico)">
        <input value={obs} onChange={(e) => setObs(e.target.value)} style={inputStyle} placeholder="Ex.: conferido com a cobrança" />
      </Campo>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18, flexWrap: "wrap" }}>
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        {acao.codigo === "AGING_MISMATCH" && (
          <Botao variante="secundario" onClick={() => onConfirmar("ACEITAR_ORIGEM", {}, obs || "Valor do ERP aceito: a diferença foi para a faixa de 31 a 90 dias.")} title="Mantém o total vencido do ERP e coloca a diferença na faixa de 31 a 90 dias">
            Usar o valor do ERP
          </Botao>
        )}
        <Botao onClick={gravar}>Gravar correção</Botao>
      </div>
    </Modal>
  );
}

function ModalTirar({ nome, onFechar, onConfirmar }: { nome: string; onFechar: () => void; onConfirmar: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <Modal titulo={`Tirar do envio · ${nome}`} aberto onFechar={onFechar} largura={520}>
      <div style={{ fontSize: 13.5, color: tema.ink, lineHeight: 1.6 }}>O cliente não vai no arquivo deste mês. Ele continua na carteira e volta no próximo envio.</div>
      <Campo rotulo="Motivo (opcional, fica no histórico)">
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} style={inputStyle} placeholder="Ex.: cadastro em revisão no ERP" />
      </Campo>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao variante="perigo" onClick={() => onConfirmar(motivo.trim())}>Tirar do envio</Botao>
      </div>
    </Modal>
  );
}
