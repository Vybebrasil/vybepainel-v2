# Planejamentos dos clientes e Centro de Operação — plano

Pedido do Paulo em 19/10/2026. Status: **construído**. Migração aplicada em 19/10/2026 com o "Aprovado" do
Paulo. Falta o Paulo configurar o e-mail e a chave dos agentes na Vercel.

Decisões do Paulo (19/10/2026): e-mail pelo **Gmail da Vybe**; agentes
publicam **direto pelo conector**; editar e mandar é do **head do cliente e do
Paulo** (quem administra); todos da equipe veem.

## O que o Paulo pediu

- Os agentes de conteúdo de cada cliente (projetos no Claude: Mangaba,
  Hebravet, DiaLabPrime, Hellen Rocha, Gonzalez, Experimente, Dia Center,
  Conectasim, Copirece, Serra Grande…) geram o planejamento do mês para o
  cliente aprovar **antes** de cadastrar e produzir.
- Padronizar o documento (UI/UX igual para todos), mantendo a identidade de
  cada cliente (cores, logo, tom).
- Uma aba no painel, em cada cliente, para o head (Vinícius ou Ewerton)
  revisar, **editar direto no painel** e mandar para aprovação do cliente.
- PDF e documento ficam no Drive, na pasta do cliente, organizados.
- Link de aprovação que o head manda pelo WhatsApp e **cópia por e-mail**
  para o cliente.
- Aviso explícito para o head (na tela dele e no Escritório) sempre que
  houver algo dos clientes dele para revisar.
- No Escritório: sala **Centro de Operação**, com um NPC por agente, cada um
  na sua mesa, com o nome do cliente; o NPC mostra o que tem pronto.

## Fluxo proposto

1. **Rascunho** — o agente gera o planejamento no formato padrão (ver
   "Documento padrão") e ele entra no painel, no cliente.
2. **Para revisar** — o head do cliente recebe o aviso; abre, edita os
   textos e as peças no próprio painel e comenta.
3. **Enviado ao cliente** — o head clica em "Mandar para o cliente": o painel
   gera o PDF e o Documento Google na pasta do cliente no Drive, cria um link
   de aprovação e manda cópia por e-mail para o cliente. O head copia o link
   para o WhatsApp.
4. **Aprovado** ou **Ajustes pedidos** — o cliente aprova ou pede ajustes
   (com comentário) pela página do link, sem precisar de login. O head é
   avisado. Ajustes voltam para "Para revisar".
5. **Cadastrado** — aprovado, o head (ou o agente) cadastra as peças no
   painel a partir do planejamento, com cliente e datas já preenchidos.

Cada mudança de status fica registrada (quem, quando, o quê).

## Documento padrão

- Estrutura fixa para todos os clientes: capa; visão do mês (números e
  linhas de conteúdo); datas que orientam o mês; calendário; uma ficha por
  peça (data, formato, tema, legenda, referência visual); observações.
- Identidade do cliente por parâmetros: cor principal e de apoio, logo,
  fonte de destaque e tom de voz, guardados no cadastro do cliente.
- O conteúdo fica estruturado (não só PDF), para o head editar no painel e o
  painel gerar o PDF sempre igual.
- Para os chats: uma skill "Planejamento Vybe" com a estrutura e o formato de
  saída, instalada em cada projeto de agente (substitui o prompt solto que
  hoje gera documentos diferentes).

## Como o agente entrega no painel

Os agentes vivem no Claude, fora do painel. Duas formas:

- **Fase 1 (simples):** o agente gera o arquivo no formato padrão e o head
  (ou Paulo) importa na aba do cliente, arrastando o arquivo.
- **Fase 2:** um conector do painel para os agentes enviarem direto (o
  agente "publica" o planejamento no cliente certo, sem arrastar).

## Centro de Operação (Escritório)

- Sala comum nova, montada pelo motor de construção (como as outras): uma
  mesa por agente, NPC com o nome do cliente, painel na parede com o estado
  de cada planejamento.
- Clicar no NPC mostra o planejamento do cliente e o status; o head é levado
  para lá pelo aviso.

## O que falta decidir ou preparar

- **E-mail:** o painel ainda não envia e-mail. Precisa de um serviço de envio
  configurado pelo Paulo (a credencial vai direto nas variáveis da Vercel;
  o agente não manuseia senha).
- **Banco:** tabelas novas (planejamentos, peças do planejamento, histórico,
  links de aprovação) e campos de identidade no cliente, por migração
  revisável aplicada com "Aprovado".

## O que foi construído

- Banco: `migrations/2026-10-20-planejamentos.sql` — `vybe_clientes.identidade`,
  `vybe_planejamentos` (um ativo por cliente e mês, versão, estado, arquivos do
  Drive, hash do link) e `vybe_planejamento_eventos` (histórico). Também abre a
  camada `operacao` do Escritório.
- Servidor: `server/planejamentos.js` (regras e permissões),
  `server/planejamento-documento.js` (documento padrão),
  `server/planejamentos-api.js` (rotas), `server/email.js` (Gmail),
  `vybe_drive.js` (`pastaDePlanejamento`, `salvarDocumentoEPdf`).
- Rotas, todas em `api/painel.js`:
  - `area=planejamentos`: listar, detalhe, prévia, pendentes, operacao,
    criar, editar, estado, comentar, identidade, enviar;
  - `/aprovar/<token>`: página pública do cliente (rewrite em `vercel.json`).
    O link vale 30 dias e o banco guarda só o hash. Editar depois de enviado
    invalida o link;
  - `area=agentes&chave=…`: conector MCP dos agentes, com `listar_clientes`,
    `formato_do_planejamento`, `publicar_planejamento` e `ver_planejamento`.
- Tela: `vybe-planejamentos.js`. Cartão "Planejamentos" no detalhe do cliente;
  janela com Documento, Editar, Histórico e Identidade. O envio gera o link,
  salva doc e PDF em `Cliente/Planejamentos/<ano>` no Drive e manda a cópia
  por e-mail. Drive e e-mail não seguram o link e, quando falham, aparece o
  aviso. O botão abre o WhatsApp.
- Aviso do head: botão fixo "N planejamentos esperando você" no painel inteiro,
  e no Escritório a linha da sala Centro de Operação.
- Skill dos agentes: `skills/planejamento-vybe/SKILL.md` (estrutura padrão e
  como publicar pelo conector).
- Testes: `tests/planejamentos.test.mjs`, `tests/planejamentos-escritorio.test.mjs`.

## Para ligar em produção (Paulo, na Vercel)

- `GMAIL_USUARIO` (o Gmail da Vybe) e `GMAIL_SENHA_APP` (senha de app criada na
  conta Google, com verificação em duas etapas). Sem elas, o link funciona e o
  painel avisa que o e-mail não foi.
- `AGENTES_CHAVE`: segredo de 24+ caracteres. O conector de cada agente é
  `https://vybepainel-v2.vercel.app/api/painel?area=agentes&chave=<AGENTES_CHAVE>`.
- Opcional: `PAINEL_URL`, se o domínio do link for outro.

## Cadastrar as peças com um botão (20/10/2026)

Pedido do Paulo: depois que o cliente aprova, o head cadastra todas as peças
com um botão.

- Decisões do Paulo: prazo pelo Prazo de Ouro (7 dias), com margem mínima de
  2 dias antes da veiculação. Quem executa e onde entra seguem as regras que o
  painel já usa.
- Conteúdo vai para Produção, pelo destino do formulário (`cadastrosDestiny`):
  - Card, Carrossel e Story vão para Design & Edição.
  - Reels, Vídeo e Fotografia vão para Produção (Foto e Vídeo), com captação.
- "Outro" vai para Solicitações, sem responsável, para a triagem.
- Da equipe da regra, a peça vai para quem mais fez peças daquele cliente nos
  últimos 120 dias. Sem histórico claro, fica a equipe toda, como no formulário.
- Servidor: `cadastrarPecas` em `server/planejamentos.js`, rota
  `area=planejamentos&acao=cadastrar`. Uma transação: se uma falha, nenhuma
  entra. Cada peça guarda o `conteudo_id`, o planejamento fica "Cadastrado" e
  clicar de novo é recusado.
- Tela: confirmação com o que vai acontecer por formato. Depois, a lista
  "demandas criadas" abre cada uma.
- "Já cadastrei à mão" continua para quem cadastrou pelo formulário.

## Visual e uso refeitos (20/10/2026)

Pedido do Paulo depois do primeiro planejamento publicado (Hellen Rocha).

- **Alertas:**
  - No Centro de Operação, o agente com planejamento esperando ação (revisar,
    ajustes ou aprovado para cadastrar) ganha um balão grande e brilho. Isso
    vale para o head do cliente e para quem administra.
  - A barra do jogo mostra um botão com o pedido, e chega um aviso quando
    aparece algo novo.
  - O aviso fixo do painel diz o cliente e a ação.
- **Documento:** padrão Vybe único. A capa é escura, com o logo da Vybe × o
  logo do cliente (ou o nome, sem logo). Sem cores nem fonte por cliente.
  - As peças trazem número, formato, legenda ou roteiro, referência e "Para
    você decidir".
  - O número que o agente põe no tema sai.
  - Limites maiores: a referência ia até 600 letras e cortava o texto das telas.
- **Página do cliente:** explica como aprovar. Em cada peça, "Pedir ajuste
  nesta peça". No fim, o nome e "Aprovar planejamento" ou "Enviar os ajustes".
  - Funciona no celular.
  - Ajuste em qualquer peça devolve o planejamento ao head.
- **Janela do planejamento:**
  - etapas no topo (Revisar, Com o cliente, Aprovado, Cadastrado) com o
    próximo passo;
  - peças em cartões que abrem e fecham, com o pedido do cliente marcado;
  - histórico em linha do tempo com os comentários como conversa;
  - aba "Marca do cliente" só com o logo (com prévia) e o tom de voz.
- **VybeHub:** ver a seção seguinte.

## Aprovação pelo VybeHub (20/10/2026)

Decisão do Paulo: o cliente aprova pelo VybeHub dele. O portal já lê o banco
da Vybe.

- **Painel:**
  - A rota `area=portal`, sem sessão, exige o cabeçalho `Authorization:
    Bearer <PORTAL_CHAVE>`.
  - O campo `rota` escolhe entre `planejamentos` (lista o que foi mandado ao
    cliente: enviado, ajustes, aprovado, cadastrado; nunca o rascunho) e
    `responder` (a mesma regra do link: ajuste por peça, versão conferida,
    registro "Nome (VybeHub)").
- **VybeHub:**
  - `server/integrations/painelPlanejamentos.ts` faz as chamadas.
  - Os procedimentos `portal.planejamentos` e `portal.responderPlanejamento`
    usam o cliente da sessão.
  - A página `Planejamentos`, com contador no menu e aviso na Visão Geral, fica
    em `/cliente/<slug>/planejamentos`.
- **WhatsApp:** a mensagem leva o cliente ao VybeHub e traz o link direto como
  reserva.
- **Para ligar:** Paulo cria `PORTAL_CHAVE`, com 24 caracteres ou mais, e põe o
  mesmo valor nos dois projetos da Vercel (vybepainel-v2 e vybehub). Depois,
  Redeploy nos dois.

## Objetivo, linha e texto das telas por peça (20/10/2026)

Paulo notou que o planejamento da Hellen não trouxe tudo o que o PDF do agente
tinha.

- A peça ganhou os campos `linha`, `objetivo` e `telas` (lista).
- O documento, o VybeHub e o editor mostram as telas numeradas ao lado da
  legenda. No editor, as telas vão uma por linha.
- Os planejamentos de antes desses campos traziam tudo junto na referência
  ("Objetivo: … Texto das telas: Tela 1: … | Tela 2: …"). `pecaParaMostrar`
  separa isso na hora de mostrar e ao abrir no editor, sem mexer no que está
  guardado.
- O formato do conector e a skill `planejamento-vybe` pedem os campos novos.
- O que foi cortado em 600 letras antes da correção não volta: precisa
  republicar. O botão "Reabrir para editar" agora também aparece quando o
  planejamento está com o cliente (o link deixa de valer).

## Peça por peça, um link só e logos do Drive (20/10/2026)

Pedidos do Paulo:
- aprovar e reprovar cada conteúdo, primeiro o head, depois o cliente;
- um link só (o do VybeHub);
- a diagramação do documento dentro do VybeHub;
- logos dos clientes do Drive;
- Centro de Operação mais claro.

- **Decisões por peça:**
  - Ficam em `conteudo.revisoes`, chaveadas pela assinatura do conteúdo da
    peça (`assinaturaDaPeca`). Peça que muda perde a decisão; a que não muda
    continua aprovada na rodada seguinte.
  - Só o servidor grava decisões (`revisarPecaHead`, `marcarPecaPorLink`,
    `marcarPecaDoPortal`). Edição e publicação do agente trazem as decisões
    do banco, nunca as do pedido.
- **Head:** revisa na aba Documento (o mesmo documento, `revisor: 'head'`),
  com "Peça OK" ou "Ajustar" com nota. O agente lê os ajustes por peça em
  `ver_planejamento`. A revisão interna nunca vai para o cliente.
- **Cliente:**
  - Em cada peça, "Aprovar esta peça" ou "Pedir ajuste", salvo na hora. No fim,
    "Enviar respostas": as peças sem resposta contam como aprovadas, e qualquer
    ajuste devolve ao head.
  - O cadastro continua só com tudo aprovado.
- **VybeHub:** mostra o documento do painel num quadro (`rota: documento`,
  `modo: 'portal'`) e grava pelo login do cliente (`rota: marcar` e
  `responder`). É uma diagramação só.
- **Envio:** a mensagem do WhatsApp leva só o link do VybeHub. O link direto
  fica guardado em "Cliente sem acesso ao VybeHub?".
- **Logos:**
  - `logosNoDrive` procura imagens com "logo" e o nome do cliente.
  - Ao mandar, sem logo escolhido, usa o melhor achado.
  - A aba "Marca do cliente" mostra as opções para trocar.
  - A capa usa `area=logo`, que serve o arquivo do Drive sem torná-lo público.
- **Centro de Operação:**
  - O balão ficava atrás das outras etiquetas (`z-index` 5 contra 99500).
  - Agora cada agente com planejamento mostra a situação escrita e o placar
    ("Com o cliente · 8 de 18 respondidas").

## Tela cheia e edição na própria peça (20/10/2026)

- A janela do planejamento ocupa a tela inteira, com o topo compacto, e o
  documento fica com a maior parte.
- Cada peça do documento do head ganhou "Editar peça". Abre uma janela com
  todos os campos e salva uma versão nova (`editarPlanejamento`); a peça
  editada fica com o OK de quem editou.
- O logo da Vybe está embutido no documento (`server/vybe-logo.js`): no ar, o
  arquivo em /assets ganha nome com hash e a imagem quebrava.
- No Escritório, o aviso do planejamento virou um balão acima da barra, e a
  barra continua numa linha.
