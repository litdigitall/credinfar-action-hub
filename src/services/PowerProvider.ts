// Inicialização do SDK do Power Apps.
// No @microsoft/power-apps 1.1.x a inicialização com o host é implícita; o app
// confirma a conexão lendo o contexto via getContext(). Em DEV (vite dev) o
// handshake é pulado e o app roda 100% em modo local.
import { useEffect, useState } from "react";

// Usuário autenticado no host Power Apps (Entra ID) — usado na trilha de
// auditoria (RF-015) e no cartão do usuário. Em DEV fica o placeholder.
export const usuarioAtual = {
  nome: "Analista de Crédito",
  email: "",
};

// O Dataverse SÓ pode ser chamado depois do handshake com o host — a camada
// de persistência aguarda esta promise antes da primeira chamada (evita a
// corrida em que o app "desiste" do Dataverse antes de ele estar pronto).
let resolverConexao: () => void = () => undefined;
const conexaoPromise = new Promise<void>((resolve) => {
  resolverConexao = resolve;
});
if (import.meta.env.DEV) resolverConexao();

export function aguardarConexao(): Promise<void> {
  // timeout de segurança: nunca trava o app se o host não responder
  return Promise.race([
    conexaoPromise,
    new Promise<void>((resolve) => setTimeout(resolve, 15000)),
  ]);
}

export function usePowerPlatform(): boolean {
  const [pronto, setPronto] = useState(import.meta.env.DEV);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let ativo = true;
    (async () => {
      try {
        const { getContext } = await import("@microsoft/power-apps/app");
        const contexto = await getContext();
        // Nome real do usuário para a trilha (quem comentou/alterou status):
        // fullName; senão o prefixo do e-mail corporativo.
        if (contexto.user.fullName) {
          usuarioAtual.nome = contexto.user.fullName;
        } else if (contexto.user.userPrincipalName) {
          usuarioAtual.nome = contexto.user.userPrincipalName.split("@")[0];
        }
        if (contexto.user.userPrincipalName)
          usuarioAtual.email = contexto.user.userPrincipalName;
        console.info(
          `Power Apps conectado, app ${contexto.app.appId} (env ${contexto.app.environmentId}).`
        );
      } catch (erro) {
        // Sem host Power Apps (ex.: preview local do build) — segue com mocks.
        console.warn("Power Apps SDK não inicializado; usando dados locais.", erro);
      } finally {
        resolverConexao();
        if (ativo) setPronto(true);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  return pronto;
}
