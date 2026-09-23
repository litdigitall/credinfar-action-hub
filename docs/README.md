# Credinfar Action Hub · do dado à decisão

Protótipo em Power Apps (Code App, React + TypeScript) para o time de Crédito e Cobrança da Abbott.
Tudo simulado, sem chamada externa: dados sintéticos e determinísticos. Assinatura: *By CFS Navigator*.

## O negócio, em uma página

A **Credinfar** é a associação de crédito e cobrança das indústrias farmacêuticas, veterinárias e de
cosméticos (cerca de 150 associadas, desde 1972). Funciona por troca: todo mês cada associada **envia
a posição dos seus clientes** (arquivo INFASSOC.SIC) e, em troca, **consulta como esses clientes pagam
os outros fornecedores** (Ficha de Informações, nota de risco de A a E, histórico de débitos de 12
meses, lista semanal de Performance, balanços). Quem envia mais pode consultar mais: o limite mensal é
1,5 consulta por cliente enviado.

Hoje a consulta é manual, CNPJ a CNPJ, no portal. A API muda o jogo porque permite:

| O que a integração permite | Decisão que sai daí |
|---|---|
| **Ler a carteira inteira todo mês** dentro do limite de 1,5x (3.000 clientes cabem em 4.473 consultas) | Ser avisado de quem **piorou no mercado antes de atrasar com a gente**: reduzir limite, pedir garantia, segurar vendas |
| Cruzar o **nosso vencido** com o **vencido no mercado** | Separar quem **atrasa com todo mundo** (risco de perda, cobrar primeiro) de quem **atrasa só conosco** (nota divergente, boleto, disputa: resolve com uma ligação) |
| Cruzar **uso do limite** com **nota e pontualidade no mercado** | Achar **bom pagador com o limite cheio**: venda travada sem motivo, aumentar o limite |
| Guardar cada leitura | Ver **tendência** (melhorando, estável, piorando) e o **retrato da carteira por nota** |

O app foi desenhado em torno dessas decisões, não das telas do sistema.

## As telas

- **Hoje**: a tela inicial é uma lista curta. "Comece por estas 5": as decisões de maior valor entre as
  que a carteira pede no mês (2 de risco, 2 de cobrança, 1 de venda). Cada cartão diz o que está
  acontecendo, por que importa, quanto dinheiro está em jogo e oferece a ação com o valor já sugerido
  ("Reduzir limite de R$ 480.000 para R$ 384.000"). Um clique, uma confirmação, e a decisão vai para o
  histórico com o nome de quem decidiu. Filtros: Risco, Cobrança, Vender mais.
- **Clientes**: busca por nome ou CNPJ. Mostra a posição conosco, a decisão que a leitura mensal já
  pede (sem gastar consulta) e, a pedido, a ficha de hoje: leitura com as ações, tabela "com a gente x
  no mercado" (deve, vencido, atraso médio, limite), tendência de 12 meses. O XML e as tabelas ficam em
  "Ver detalhes". Também consulta empresa que não é cliente (8 dígitos do CNPJ).
- **Análises**: a carteira inteira em nove gráficos, cada um respondendo a uma pergunta de negócio e com a
  leitura escrita embaixo. Inadimplência em 12 meses, débito e vencido por mês, carteira por nota da
  Credinfar (quanto do dinheiro está com quem o mercado avalia mal), aging do vencido, "com a gente x no
  mercado" (quem atrasa com todo mundo x só conosco, com clique para abrir o cliente), migração de notas
  no mês (quem piorou antes de atrasar com a gente), os 10 maiores devedores, débito por estado e o
  efeito das decisões tomadas no app (limite retirado, limite dado, débito protegido, cobranças).
- **Envio do mês**: três passos em uma tela (receber a carteira, corrigir o que travou, enviar). Só
  aparece o que impede o envio; cada travado tem Corrigir ou Tirar do envio; "Gerar arquivo e enviar"
  monta o INFASSOC.SIC no layout oficial, confere e devolve o protocolo. Avisos ficam recolhidos.
- **Histórico**: envios, consultas e quem fez o quê (exporta para Excel).
- **Configurações**: essencial do envio, modo demonstração (IP não cadastrado, limite atingido, chave
  ausente) e ajuda (o que trava o envio, layout do arquivo, pontos a confirmar com a Credinfar).

## As regras de decisão (`src/engine/sinais.ts`, fixas, sem IA)

| Leitura | Quando aparece | Ações oferecidas |
|---|---|---|
| Risco alto de não receber | recuperação judicial/falência ou nota E, com débito conosco | segurar vendas a prazo, reduzir limite ao débito atual, pedir garantia |
| O risco está subindo | débito ≥ R$ 50 mil e: nota caiu para C ou pior, ou entrou na lista de Performance com vencido crescendo, ou protestos com vencido alto | reduzir limite (sugerido), pedir garantia, só acompanhar |
| Atrasando com todo o mercado | ≥ R$ 30 mil vencidos conosco e ≥ 25% vencido no mercado | cobrar agora e registrar (com promessa de pagamento), segurar vendas |
| Paga os outros e atrasa com a gente | ≥ R$ 20 mil vencidos conosco, < 5% no mercado, nota A ou B | ligar e registrar |
| Bom pagador com o limite cheio | nota A, < 3% vencido no mercado, sem ocorrência, usa ≥ 82% de um limite ≥ R$ 150 mil, em dia conosco | aumentar limite em 25% (editável) |

Os cortes de valor existem para a lista ficar curta: numa carteira de 3.000 clientes saem cerca de 150
decisões no mês, e a tela inicial mostra cinco por vez. A leitura mensal guarda 300 consultas de
reserva para o dia a dia e não reabre o que já foi decidido no mês.

## O que o motor garante

- **INFASSOC.SIC no layout oficial** (`LAYOUT CREDINFAR.pdf`): 30 campos, 270 posições, datas MMAAAA,
  valores inteiros, nada em branco nas posições 1 a 20 nem a partir da 121, CRLF. `src/engine/infassoc.ts`.
- **Conferência do envio** (`src/engine/regras.ts`): quatro travas e quatro avisos.
- **API Credinfar simulada** conforme o Manual Técnico V1.4 (`src/engine/credinfarMock.ts`): consulta
  por raiz de CNPJ, XML `dbCredinfar` com os 26 blocos e os nomes originais das tags, dados de ontem
  (D-1), até 10 fornecedores sem identificação, três balanços ou nenhum, alerta da lista semanal de
  Performance, recusa por IP, por limite mensal e por chave de acesso.
- **Histórico** de tudo: quem, quando, o quê, antes e depois.

## Roteiro de demonstração (5 minutos)

1. **Hoje**: leia um cartão de risco em voz alta (o que aconteceu, por quê, quanto está em jogo) e
   clique em "Reduzir limite de X para Y". Mostre um de "Vender mais" e aumente o limite. Mostre um de
   cobrança "Paga os outros em dia e atrasa com a gente" e registre a ligação com a promessa.
2. **Análises**: mostre a migração de notas (61 clientes pioraram antes de atrasar com a gente), o gráfico
   "com a gente x no mercado" (laranja atrasa com todo mundo, azul atrasa só conosco) e a concentração.
3. **Clientes**: busque "VetPrime", "Consultar a Credinfar agora": nota E, 45% vencido no mercado,
   tabela com a gente x no mercado. "Ver detalhes" mostra o XML do manual.
4. **Envio do mês**: corrija a Farmácia Boa Vida ("Usar o valor do ERP"), o CNPJ da Drogaria Horizonte
   (61.412.110/0001-55), tire os demais, "Ver o arquivo antes", "Gerar arquivo e enviar".
5. **Histórico**: as decisões, a cobrança e o envio com nome e hora.

## Rodar, testar e publicar

```bash
npm install
npm run dev          # http://localhost:3003
npm run build        # tsc && vite build
npm run testar       # 73 verificações do motor (layout 270, regras, envio, API simulada, decisões)
npm run testar:e2e   # 21 verificações no navegador (exige npm run dev na 3003)
pac code push --environment <url do ambiente>
```

Solution própria **CFSCredinfarHub** (publisher `cfscredinfar`, prefixo `cdf`), sem tabelas nesta fase.
O app só entra na solution pelo portal (Soluções → CFSCredinfarHub → Adicionar existente → Aplicativo).

## Limites do protótipo e próximos passos

- Dados no navegador de quem usa. Próximo passo: tabelas na base de dados da solução (cliente, leitura
  mensal, decisão, envio, histórico) para uso compartilhado e para comparar um mês com o outro de verdade.
- API simulada. Para ligar: chave de acesso com termo de responsabilidade, IP público fixo cadastrado,
  endereço de produção e uma rotina agendada (madrugada, dados D-1) que faça a leitura e guarde o XML.
- As decisões de limite e bloqueio ficam no app. Em produção seguem para o ERP (SAP) por integração.
- A carteira vem de um botão (simulação do ERP) ou CSV. Em produção o ERP entrega o lote.
- Os cortes das regras (R$ 50 mil, 25%, 82% do limite) são parâmetros a calibrar com Crédito e Cobrança.
- A confirmar com a Credinfar: regra do limite mensal (registros ou clientes), esquema oficial do XML,
  validação de um arquivo INFASSOC.SIC de teste.

## Fontes

Documento Mestre Consolidado (16/09/2026), Manual Técnico da API Web Credinfar V1.4 (07/2025), material
"Regras da API de Consultas", layout oficial do INFASSOC.SIC e o site da Credinfar (ferramentas:
FIC, Risk Rating, Sugestão de Limite, Histórico de Débitos, Avaliação de Performance; relatórios:
Rating de Carteira, DSO, Inadimplência, Alertas de Comportamento). Os documentos do cliente não fazem
parte deste repositório.
