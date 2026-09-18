// Smoke E2E do Credinfar Action Hub (exige npm run dev na 3003):
//   Hoje: lista curta de decisões, tomar uma decisão de cada tipo
//   Clientes: decisão da leitura mensal, ficha de hoje, comparação com o mercado
//   Envio do mês: corrigir, tirar do envio, ver o arquivo, enviar
//   Configurações (modo demonstração) e Histórico
const fs = require("fs");
const { chromium } = require("playwright-core");
(async () => {
  fs.mkdirSync("scripts/shots", { recursive: true });
  for (const f of fs.readdirSync("scripts/shots")) fs.unlinkSync(`scripts/shots/${f}`);
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const falhas = [];
  const ok = (c, m) => { console.log((c ? "OK " : "FALHA ") + m); if (!c) falhas.push(m); };
  page.on("pageerror", (e) => falhas.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon/i.test(m.text())) falhas.push(`console: ${m.text()}`); });
  await page.goto("http://localhost:3003", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const main = () => page.locator("main").innerText();
  const shot = (n) => page.screenshot({ path: `scripts/shots/${n}.png`, fullPage: true });
  const ir = async (nome) => { await page.locator("aside.sidebar").getByRole("button", { name: nome }).click(); await page.waitForTimeout(450); };

  // ---------------------------------------------------------------- Hoje
  const menu = await page.locator("aside.sidebar").innerText();
  ok(["Hoje", "Clientes", "Envio do mês", "Histórico", "Configurações"].every((t) => menu.includes(t)), "menu: Hoje, Clientes, Envio do mês, Histórico, Configurações");
  const t0 = await main();
  ok(/Olá, /.test(t0) && t0.includes("Comece por estas 5"), "tela inicial cumprimenta e prioriza as 5 decisões de maior valor");
  ok(!/ACTION_REQUIRED|BLOCKER|READY_FOR_APPROVAL|RISCO_|ATRASA_/.test(await page.locator("body").innerText()), "sem siglas técnicas na tela");
  ok((await page.locator('[data-testid="decisao"]').count()) === 5, "cinco cartões de decisão na tela inicial");
  await shot("01-hoje");

  // Risco: primeira ação do primeiro cartão
  await page.getByRole("button", { name: /^Risco/ }).click();
  await page.waitForTimeout(300);
  const risco = page.locator('[data-testid="decisao"]').first();
  const nomeRisco = (await risco.locator("button").first().innerText()).trim();
  ok((await risco.innerText()).length > 80, `cartão de risco explica o motivo (${nomeRisco})`);
  await risco.getByRole("button").nth(1).click(); // 0 = nome do cliente, 1 = ação principal
  await page.waitForTimeout(300);
  await shot("02-decidir");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await page.waitForTimeout(400);
  ok(!(await page.locator('[data-testid="decisao"]').first().innerText()).includes(nomeRisco), "cartão decidido sai da lista");
  ok(/últimas decisões/i.test(await main()), "decisão aparece em Últimas decisões");

  // Vender mais: aumentar limite
  await page.getByRole("button", { name: /^Vender mais/ }).click();
  await page.waitForTimeout(300);
  const opp = page.locator('[data-testid="decisao"]').first();
  await opp.getByRole("button", { name: /Aumentar limite de/ }).click();
  ok((await page.getByRole("dialog").innerText()).includes("Novo limite de crédito"), "aumento de limite mostra o valor sugerido e deixa editar");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await page.waitForTimeout(300);

  // Cobrança: registrar contato com promessa
  await page.getByRole("button", { name: /^Cobrança/ }).click();
  await page.waitForTimeout(300);
  const cob = page.locator('[data-testid="decisao"]').first();
  await cob.getByRole("button").nth(1).click();
  await page.getByLabel("Data prometida").fill("2026-09-30");
  await page.getByLabel("Observação").fill("Falei com o financeiro, paga na sexta");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await page.waitForTimeout(300);
  ok((await main()).includes("prometeu pagar em 30/09/2026"), "cobrança registra a promessa de pagamento");

  // ---------------------------------------------------------------- Clientes
  await ir("Clientes");
  ok(/pedem decisão agora/i.test(await main()), "Clientes sugere quem pede decisão");
  await page.getByLabel("Buscar cliente").fill("vetprime");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /VETPRIME/ }).first().click();
  await page.waitForTimeout(300);
  const t1 = await main();
  ok(t1.includes("Deve para a gente") && t1.includes("Consultar a Credinfar agora"), "cliente mostra a posição conosco e oferece a ficha de hoje");
  await page.getByRole("button", { name: "Consultar a Credinfar agora" }).click();
  await page.waitForTimeout(500);
  const t2 = await main();
  ok(t2.includes("O que o mercado diz hoje") && t2.includes("Com a gente") && t2.includes("No mercado"), "ficha de hoje compara com a gente x no mercado");
  ok((await page.locator('[data-testid="decisao"]').count()) >= 1, "ficha traz a leitura com as ações");
  await shot("03-cliente");
  await page.getByText("Ver detalhes").click();
  await page.getByRole("button", { name: "Resposta técnica (XML)" }).click();
  await page.waitForTimeout(300);
  ok((await main()).includes("<dbCredinfar>"), "detalhes trazem o XML da Credinfar");

  // ---------------------------------------------------------------- Envio do mês
  await ir(/^Envio do mês/);
  const t3 = await main();
  ok(t3.includes("Corrigir o que travou") && t3.includes("travado(s)"), "envio do mês abre no passo de correção");
  const boaVida = page.locator('[data-testid="travado"]', { hasText: "FARMACIA BOA VIDA" });
  await boaVida.getByRole("button", { name: "Corrigir" }).click();
  await page.getByRole("button", { name: "Usar o valor do ERP" }).click();
  await page.waitForTimeout(300);
  const horizonte = page.locator('[data-testid="travado"]', { hasText: "DROGARIA HORIZONTE" });
  await horizonte.getByRole("button", { name: "Corrigir" }).click();
  await page.getByLabel("CNPJ correto").fill("61412110000155");
  await page.getByRole("button", { name: "Gravar correção" }).click();
  await page.waitForTimeout(300);
  let voltas = 0;
  while ((await page.locator('[data-testid="travado"]').count()) > 0 && voltas < 40) {
    await page.locator('[data-testid="travado"]').first().getByRole("button", { name: "Tirar do envio" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Tirar do envio" }).click();
    await page.waitForTimeout(200);
    voltas += 1;
  }
  ok((await main()).includes("Tudo pronto para enviar"), `travados resolvidos (2 corrigidos, ${voltas} tirados): tudo pronto para enviar`);
  await page.getByText(/avisos, só para conhecimento/).click();
  ok((await main()).includes("Não impedem o envio"), "avisos ficam recolhidos e são informativos");
  await page.getByRole("button", { name: "Ver o arquivo antes" }).click();
  await page.waitForTimeout(500);
  ok((await main()).includes("linhas de 270 posições"), "prévia do arquivo com 270 posições");
  await shot("04-envio");
  await page.getByRole("button", { name: "Gerar arquivo e enviar" }).click();
  await page.waitForTimeout(600);
  ok((await main()).includes("Enviado à Credinfar") && (await main()).includes("Protocolo"), "envio concluído com protocolo");

  // ---------------------------------------------------------------- Configurações (modo demonstração)
  await ir("Configurações");
  await page.getByRole("button", { name: "Simular IP não cadastrado" }).click();
  await page.waitForTimeout(300);
  await ir("Clientes");
  await page.getByRole("button", { name: "Consultar a Credinfar agora" }).click();
  await page.waitForTimeout(400);
  ok((await main()).includes("recusou a consulta"), "IP não cadastrado: recusa em linguagem simples");
  await ir("Configurações");
  await page.getByRole("button", { name: "Voltar ao IP cadastrado" }).click();
  await page.waitForTimeout(300);

  // ---------------------------------------------------------------- Histórico
  await ir("Histórico");
  const t4 = await main();
  ok(t4.includes("Decisão de crédito") && t4.includes("Cobrança registrada") && t4.includes("Envio à Credinfar"), "histórico guarda decisões, cobranças e o envio");
  await shot("05-historico");

  // Mobile
  await page.setViewportSize({ width: 390, height: 800 });
  await page.locator("button.burger").click();
  await page.locator("aside.sidebar").getByRole("button", { name: /^Hoje/ }).click();
  await page.waitForTimeout(400);
  await shot("06-mobile");

  await browser.close();
  console.log(falhas.length === 0 ? "\nE2E: tudo passou." : `\nE2E: ${falhas.length} falha(s):\n- ${falhas.join("\n- ")}`);
  process.exit(falhas.length === 0 ? 0 : 1);
})();
