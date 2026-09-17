# Credinfar Action Hub

Protótipo em Power Apps (Code App, React + TypeScript + Vite) do processo de crédito e cobrança
Abbott × Credinfar, organizado em três momentos:

1. **Enviar**: receber a carteira do mês, corrigir o que travou e enviar o arquivo INFASSOC.SIC
   (layout oficial da Credinfar, 270 posições) com um botão.
2. **Consultar**: ficha do cliente na Credinfar (API simulada conforme o manual V1.4) com uma
   recomendação em linguagem simples.
3. **Acompanhar**: histórico de envios, consultas e de quem fez o quê.

Dados sintéticos e determinísticos, sem chamada externa. By CFS Navigator.

```bash
npm install
npm run dev          # http://localhost:3003
npm run testar       # testes do motor
npm run testar:e2e   # smoke no navegador (com o dev server ligado)
npm run build
```

Documentação completa, roteiro de demonstração e limites do protótipo: [docs/README.md](docs/README.md).
