# Credinfar Action Hub · protótipo funcional (versão simples)

Protótipo em Power Apps (Code App, React + TypeScript) do processo Abbott × Credinfar. Tudo simulado,
sem chamada externa: os dados são sintéticos e determinísticos. Assinatura: *By CFS Navigator*.

A primeira versão seguia o Documento Mestre ao pé da letra (nove telas, sete estados, oito tipos de
regra). Esta versão organiza o trabalho de quem usa em **três momentos**:

| Momento | O que a pessoa faz | Tela |
|---|---|---|
| **Enviar** (uma vez por mês) | Recebe a carteira, corrige o que travou e envia à Credinfar | Envio do mês |
| **Consultar** (no dia a dia) | Busca um cliente e vê a ficha da Credinfar com uma recomendação | Consultar cliente |
| **Acompanhar** | Vê os envios, as consultas e quem fez o quê | Histórico |

Configurações guarda o essencial do envio, o modo demonstração e a ajuda.

## Envio do mês: três passos em uma tela

1. **Receber a carteira** do ERP (ou importar um CSV).
2. **Corrigir o que travou.** Só aparecem os clientes que não cabem no arquivo da Credinfar:
   CNPJ que não confere, cadastro incompleto, faixas de vencidos que não fecham com o total, valor que
   não cabe. Cada um tem duas saídas: **Corrigir** (o formulário muda conforme o problema; nos vencidos
   há o atalho "Usar o valor do ERP") ou **Tirar do envio**.
3. **Enviar.** Um botão só: "Gerar arquivo e enviar". O app monta o INFASSOC.SIC no layout oficial,
   confere linha por linha, registra o envio e devolve o protocolo. "Ver o arquivo antes" mostra as
   primeiras linhas e explica os campos.

Os **avisos** (débito acima do limite, perto do limite, vencidos há mais de 90 dias, sem compra há 6
meses) são informativos: não pedem decisão e não impedem o envio. Para quem usa, o envio tem três
situações: Em preparação, Pronta, Enviada. Os sete estados do desenho original continuam gravados no
histórico interno.

## Consultar cliente

Busca por nome ou CNPJ (ou os 8 primeiros dígitos de uma empresa que não é cliente). A ficha mostra a
posição conosco (limite, débito, vencido) e, ao consultar a Credinfar, quatro números (avaliação de A a
E, quanto deve no mercado, quanto está vencido, ocorrências), o balanço mais recente e uma
**recomendação** com os motivos: pode liberar, manter e acompanhar, rever o limite, ou restringir e
cobrar. Regras fixas em `src/engine/recomendacao.ts`, sem IA. "Ver detalhes" abre fornecedores que
informam (até 10, sem identificação), últimos 12 meses, balanços e a resposta técnica em XML.

O limite mensal de consultas (1,5 vez o que foi enviado no mês anterior) aparece como um contador.

## O que o motor garante (igual à primeira versão)

- **Arquivo INFASSOC.SIC no layout oficial** da Credinfar (`LAYOUT CREDINFAR.pdf`): 30 campos, 270
  posições, datas MMAAAA, valores inteiros sem centavos, nada em branco nas posições 1 a 20 nem a
  partir da 121, linhas separadas por CRLF. `src/engine/infassoc.ts`.
- **Regras de conferência** em `src/engine/regras.ts`: quatro travam o envio, quatro são aviso.
- **API Credinfar simulada** conforme o Manual Técnico V1.4 (`src/engine/credinfarMock.ts`): consulta
  por raiz de CNPJ, XML `dbCredinfar` com os 26 blocos e os nomes originais das tags, dados de ontem
  (D-1), fornecedores sem identificação, três balanços ou nenhum, recusa por IP não cadastrado, por
  limite mensal atingido e por chave de acesso ausente (simuláveis em Configurações).
- **Histórico** de tudo: quem, quando, o quê, antes e depois.

## Roteiro de demonstração (5 minutos)

1. **Envio do mês**: a carteira de 3.000 clientes chegou e alguns travaram. Corrija a Farmácia Boa Vida
   ("Usar o valor do ERP") e a Drogaria Horizonte (CNPJ válido, por exemplo 61.412.110/0001-55). Tire os
   demais do envio. A tela passa sozinha para "Tudo pronto para enviar".
2. "Ver o arquivo antes", "Entender os campos da 1ª linha", depois "Gerar arquivo e enviar": protocolo
   e quantas consultas o envio dá direito no mês seguinte.
3. **Consultar cliente**: busque "Cosmetika", "Consultar na Credinfar": recomendação, avaliação, mercado.
   Abra "Ver detalhes" para mostrar o XML no formato do manual.
4. **Configurações → Modo demonstração**: "Simular IP não cadastrado", volte à consulta e mostre a
   recusa em linguagem simples. Restaure.
5. **Histórico**: envios, consultas e "Quem fez o quê", com exportação para Excel.

## Rodar, testar e publicar

```bash
npm install
npm run dev          # http://localhost:3003
npm run build        # tsc && vite build
npm run testar       # 63 verificações do motor (CNPJ, layout 270, regras, envio em um passo, API simulada)
npm run testar:e2e   # smoke no navegador (exige npm run dev na 3003); capturas em scripts/shots
pac code push --environment <url do ambiente>
```

Publicado no ambiente de desenvolvimento como "Credinfar Action Hub" (`power.config.json`). Solution
própria **CFSCredinfarHub** (publisher `cfscredinfar`, prefixo `cdf`), sem tabelas nesta fase
(`scripts/gera-solution.py`). Como nos outros Code Apps criados pelo `pac code push`, o app só entra na
solution pelo portal: Soluções → CFSCredinfarHub → Adicionar existente → Aplicativo.

## Limites do protótipo e próximos passos

- Os dados ficam no navegador de quem usa. Próximo passo: tabelas na base de dados da solução (envio,
  cliente, pendência, consulta, histórico) para uso compartilhado.
- A API Credinfar é simulada. Para ligar de verdade: chave de acesso com termo de responsabilidade, IP
  público fixo cadastrado, endereço de produção e um conector que faça a consulta e guarde o XML.
- A carteira hoje vem de um botão (simulação do ERP) ou de um CSV. Em produção, o ERP entrega o lote.
- Pontos a confirmar com a Credinfar estão em Configurações → Ajuda. O principal é a regra do limite
  mensal de consultas (registros enviados ou número de clientes).

## Fontes

Documento Mestre Consolidado (16/09/2026), Manual Técnico da API Web Credinfar V1.4 (07/2025), material
"Regras da API de Consultas" e o layout oficial do INFASSOC.SIC. Os documentos do cliente não fazem
parte deste repositório.
