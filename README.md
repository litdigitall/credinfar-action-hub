# Credinfar Action Hub

Protótipo em Power Apps (Code App, React + TypeScript + Vite) para Crédito e Cobrança: transforma a
troca de informações com a Credinfar em **decisões**.

- **Hoje**: lista curta e priorizada por valor. Quem piorou no mercado antes de atrasar com a gente
  (reduzir limite, pedir garantia), quem atrasa com todo mundo x só conosco (cobrar), e bom pagador com o
  limite cheio (vender mais). Um clique para decidir, tudo no histórico.
- **Clientes**: posição conosco x no mercado, tendência de 12 meses e as ações no mesmo lugar.
- **Envio do mês**: receber a carteira, corrigir o que travou e enviar o INFASSOC.SIC (layout oficial,
  270 posições) com um botão.
- **Histórico** e **Configurações** (modo demonstração e ajuda).

API Credinfar simulada conforme o manual V1.4; dados sintéticos e determinísticos. By CFS Navigator.

```bash
npm install
npm run dev          # http://localhost:3003
npm run testar       # motor
npm run testar:e2e   # navegador (com o dev server ligado)
npm run build
```

O negócio, as regras de decisão, o roteiro de demonstração e os limites: [docs/README.md](docs/README.md).
