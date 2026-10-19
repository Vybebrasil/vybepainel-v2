# Planejamentos dos clientes e Centro de Operação — plano

Pedido do Paulo em 19/10/2026. Status: **construído** (branch
`codex/planejamentos-plano`); falta aplicar a migração com o "Aprovado" do
Paulo, configurar e-mail e chave dos agentes na Vercel e publicar.

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
