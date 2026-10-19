---
name: planejamento-vybe
description: Monta o planejamento mensal de conteúdo de um cliente da Vybe no formato padrão da agência e publica no painel da Vybe para o head revisar e mandar ao cliente. Use sempre que pedirem o planejamento, calendário ou pauta do mês de um cliente.
---

# Planejamento Vybe

Todo cliente recebe o mesmo documento: a estrutura é a da Vybe, e a cara (cores,
logo, fonte e tom) vem do cadastro do cliente no painel. Você **não** desenha o
documento, não escolhe cores e não gera PDF: você entrega o conteúdo
estruturado, e o painel monta o documento, guarda no Drive e cuida da aprovação.

## Antes de começar

1. Confirme o cliente e o mês (AAAA-MM). Se o nome não for exato, chame
   `listar_clientes` do conector "Painel Vybe" e use o nome como está lá.
2. Chame `ver_planejamento` para o cliente e o mês. Se já houver um planejamento:
   - "Para revisar" ou "Ajustes pedidos": refaça a partir dele e dos
     comentários (do head e do cliente) que a ferramenta devolve.
   - "Com o cliente", "Aprovado" ou "Cadastrado": não publique por cima. Avise
     quem pediu; quem reabre é o head, no painel.
3. Use o que você sabe do cliente neste projeto (posicionamento, público,
   produtos, datas próprias). Não invente número, depoimento, preço, promoção
   ou data que não tenha vindo do cliente ou da equipe.

## Estrutura (sempre esta, nesta ordem)

- **resumo**: de 2 a 4 frases para o cliente, dizendo a ideia do mês. Escreva
  no tom do cliente, sem jargão de agência.
- **linhas**: de 2 a 4 linhas de conteúdo, cada uma com `titulo` (curto) e
  `texto` (o que é e por que importa).
- **datas**: datas comerciais, feriados e datas próprias que orientam o mês:
  `data` ("02/11 · seg"), `nome` e `texto` (como o cliente aproveita a data).
  Confira dia da semana e feriados do Brasil e da Bahia quando o cliente for
  de lá.
- **pecas**: uma por publicação, com:
  - `data` (AAAA-MM-DD) dentro do mês;
  - `formato`: Card, Carrossel, Reels, Fotografia, Vídeo, Stories ou Outro;
  - `tema`: uma linha;
  - `legenda`: legenda pronta, ou o roteiro no caso de vídeo;
  - `referencia` (opcional): link ou descrição visual;
  - `observacao` (opcional): o que o cliente precisa mandar ou aprovar.
- **observacoes**: o que precisa ser combinado com o cliente (fotos, gravação,
  aprovação de preço…).
- **numeros** (opcional): deixe de fora; o painel conta as peças por formato.

Fica de fora do documento o que é interno: responsáveis, prazos de produção,
pendências do painel e conversa da equipe.

## Publicar

Chame `publicar_planejamento` com `cliente`, `mes` (AAAA-MM), um `titulo`
curto (ex.: "Planejamento de conteúdo") e `conteudo` com os campos acima. O
painel avisa o head do cliente para revisar. Publicar de novo no mesmo mês, enquanto
ainda não foi mandado ao cliente, cria uma versão nova.

Depois de publicar, responda em poucas linhas: cliente, mês, quantas peças
por formato e o que ficou para combinar. Não cole o planejamento inteiro na
conversa.

Se o conector não estiver disponível, diga isso e entregue o mesmo conteúdo
em JSON, com os campos acima, para o head colar no painel. Não troque por
outro formato.
