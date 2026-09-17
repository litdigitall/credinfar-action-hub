// Smoke E2E do Credinfar Action Hub, versão simples (exige npm run dev na 3003):
//   Envio do mês: corrigir um travado, tirar os demais, ver o arquivo, enviar
//   Consultar cliente: busca, ficha com recomendação, detalhes e XML
//   Histórico e Configurações (modo demonstração: IP não cadastrado)
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
  await page.waitForTimeout(800);
  const main = () => page.locator("main").innerText();
  const shot = (n) => page.screenshot({ path: `scripts/shots/${n}.png`, fullPage: true });

  // Menu com quatro itens, sem siglas
  const menu = await page.locator("aside.sidebar").innerText();
  ok(["Envio do mês", "Consultar cliente", "Histórico", "Configurações"].every((t) => menu.includes(t)), "menu com os quatro itens do processo simples");
  ok(!/ACTION_REQUIRED|BLOCKER|READY_FOR_APPROVAL/.test(await page.locator("body").innerText()), "sem siglas técnicas na tela inicial");

  // Envio: passo 2
  const t0 = await main();
  ok(t0.includes("Corrigir o que travou") && t0.includes("Travados"), "envio do mês abre no passo de correção");
  const travados = await page.locator('[data-testid="travado"]').count();
  ok(travados > 0, `clientes travados listados: ${travados}`);
  await shot("01-envio-travados");

  // Corrigir a Farmácia Boa Vida com "Usar o valor do ERP"
  const boaVida = page.locator('[data-testid="travado"]', { hasText: "FARMACIA BOA VIDA" });
  await boaVida.getByRole("button", { name: "Corrigir" }).click();
  await page.waitForTimeout(300);
  ok((await page.getByRole("dialog").innerText()).includes("As faixas somam"), "correção mostra a soma das faixas contra o vencido");
  await shot("02-corrigir");
  await page.getByRole("button", { name: "Usar o valor do ERP" }).click();
  await page.waitForTimeout(300);
  ok((await page.locator('[data-testid="travado"]', { hasText: "FARMACIA BOA VIDA" }).count()) === 0, "cliente corrigido sai da lista de travados");

  // Corrigir o CNPJ da Drogaria Horizonte
  const horizonte = page.locator('[data-testid="travado"]', { hasText: "DROGARIA HORIZONTE" });
  await horizonte.getByRole("button", { name: "Corrigir" }).click();
  await page.getByLabel("CNPJ correto").fill("61412110000155");
  await page.getByRole("button", { name: "Gravar correção" }).click();
  await page.waitForTimeout(300);
  ok((await page.locator('[data-testid="travado"]', { hasText: "DROGARIA HORIZONTE" }).count()) === 0, "CNPJ corrigido destrava o cliente");

  // Tirar os demais do envio
  let voltas = 0;
  while ((await page.locator('[data-testid="travado"]').count()) > 0 && voltas < 40) {
    await page.locator('[data-testid="travado"]').first().getByRole("button", { name: "Tirar do envio" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Tirar do envio" }).click();
    await page.waitForTimeout(200);
    voltas += 1;
  }
  ok((await page.locator('[data-testid="travado"]').count()) === 0, `demais travados tirados do envio (${voltas})`);

  // Passo 3: ver o arquivo e enviar
  const t1 = await main();
  ok(t1.includes("Tudo pronto para enviar"), "passo 3: tudo pronto para enviar");
  await page.getByRole("button", { name: "Ver o arquivo antes" }).click();
  await page.waitForTimeout(500);
  ok((await main()).includes("linhas de 270 posições"), "prévia do arquivo com 270 posições");
  await page.getByRole("button", { name: /Entender os campos/ }).click();
  await page.waitForTimeout(300);
  ok((await main()).includes("Razão social do cliente"), "campos do arquivo explicados em português");
  await shot("03-envio-pronto");
  await page.getByRole("button", { name: "Gerar arquivo e enviar" }).click();
  await page.waitForTimeout(600);
  const t2 = await main();
  ok(t2.includes("Enviado à Credinfar") && t2.includes("Protocolo"), "envio concluído com protocolo");
  await shot("04-envio-concluido");
  await page.getByRole("button", { name: "Receber a carteira do próximo envio" }).click();
  await page.waitForTimeout(800);
  ok((await main()).includes("Corrigir o que travou") || (await main()).includes("Tudo pronto"), "nova carteira recebida reinicia o ciclo");

  // Avisos informativos
  const chipAviso = page.getByRole("button", { name: /Vencidos há mais de 90 dias/ });
  if ((await chipAviso.count()) > 0) {
    await chipAviso.click();
    await page.waitForTimeout(300);
    ok((await main()).includes("Não impedem o envio"), "avisos são informativos");
  }

  // Consultar cliente
  await page.getByRole("button", { name: "Consultar cliente", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByLabel("Buscar cliente").fill("cosmetika");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /COSMETIKA/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Consultar na Credinfar" }).click();
  await page.waitForTimeout(500);
  const t3 = await main();
  ok(/recomendação/i.test(t3) && t3.includes("Avaliação da Credinfar"), "ficha com recomendação e avaliação");
  await shot("05-consulta");
  await page.getByText("Ver detalhes").click();
  await page.getByRole("button", { name: "Resposta técnica (XML)" }).click();
  await page.waitForTimeout(300);
  ok((await main()).includes("<dbCredinfar>"), "detalhes trazem o XML da Credinfar");

  // Configurações: modo demonstração
  await page.getByRole("button", { name: "Configurações", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Simular IP não cadastrado" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Consultar cliente", exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Consultar na Credinfar" }).click();
  await page.waitForTimeout(400);
  ok((await main()).includes("recusou a consulta"), "IP não cadastrado: mensagem simples de recusa");
  await page.getByRole("button", { name: "Configurações", exact: true }).click();
  await page.getByRole("button", { name: "Voltar ao IP cadastrado" }).click();
  await page.waitForTimeout(300);
  ok((await main()).includes("Reiniciar demonstração"), "configurações com reinício da demonstração");
  await shot("06-configuracoes");

  // Histórico
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await page.waitForTimeout(400);
  const t4 = await main();
  ok(t4.includes("Envios à Credinfar") && t4.includes("Quem fez o quê") && t4.includes("Envio à Credinfar") && t4.includes("Correção ou retirada"), "histórico com envios e atividades em linguagem simples");
  await shot("07-historico");

  // Mobile
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(300);
  await shot("08-mobile");

  await browser.close();
  console.log(falhas.length === 0 ? "\nE2E: tudo passou." : `\nE2E: ${falhas.length} falha(s):\n- ${falhas.join("\n- ")}`);
  process.exit(falhas.length === 0 ? 0 : 1);
})();
