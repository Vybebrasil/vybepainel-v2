# Feed do cliente pela API oficial da Meta

O Feed do Painel de trabalho (Produção › Painel de trabalho › Feed) lê o perfil de cada cliente pelo
**Business Discovery** da API do Instagram, usando **só a conta da Vybe**. Nenhum cliente precisa conectar nada.
Vem do próprio Instagram: bio, site, seguidores, seguindo, número de posts, foto e os 12 últimos posts
(imagem, capa do vídeo, data e link).

Funciona para perfis **comerciais ou de criador** (a maioria dos clientes). Perfil pessoal ou privado continua
pela página pública de incorporação, sem a bio (aí vale o campo "Bio do Instagram" do cadastro do cliente).

## O que o Paulo faz (uma vez)

1. **Instagram da Vybe profissional e ligado a uma Página do Facebook.**
   No app do Instagram: Configurações › Tipo de conta › Conta profissional. Depois, em Central de Contas,
   ligue a conta a uma Página do Facebook da Vybe.
2. **Criar o app na Meta.** Em https://developers.facebook.com/apps › Criar app › tipo **Empresa** (Business),
   ligado ao Portfólio empresarial da Vybe.
3. **Gerar um token que não vence (usuário do sistema).**
   Em https://business.facebook.com/settings › Usuários › Usuários do sistema › Adicionar (função Administrador).
   Atribua a ele a Página da Vybe e o app. Clique em **Gerar novo token**, escolha o app e marque as permissões:
   `instagram_basic`, `pages_show_list`, `pages_read_engagement` e `business_management`.
   Validade: **Nunca**. Copie o token (não mande para ninguém nem cole no chat).
4. **Achar o id da conta do Instagram da Vybe.** No Explorador da Graph API
   (https://developers.facebook.com/tools/explorer), com esse token, rode:
   `me/accounts?fields=name,instagram_business_account`
   O número em `instagram_business_account.id` é o id (só dígitos).
5. **Pôr as duas variáveis na Vercel** (projeto vybepainel-v2 › Settings › Environment Variables, ambiente Production):
   - `META_IG_TOKEN` = o token do passo 3
   - `META_IG_USER_ID` = o id do passo 4

   Depois, **Redeploy** do último deploy de produção para as variáveis valerem.

## Como saber que ligou

Abra o Feed de um cliente com @ preenchido no cadastro: aparecem a bio do Instagram e o número de "seguindo" no
cabeçalho, e até 12 posts no ar. Sem as variáveis (ou com perfil pessoal), o cabeçalho mostra só posts e seguidores.

Token vencido ou sem permissão: o Feed não quebra (cai na página pública) e o motivo vai para o log da Vercel com o
prefixo `[feed_instagram] meta`, sem o token.

## Detalhes técnicos

- Código: `server/instagram-feed.js` (`buscarNaMeta`, `lerPerfilDaMeta`); rota `GET /api/painel?area=feed_instagram`.
- Versão da Graph API: `v23.0`. O token vai no cabeçalho `Authorization`, nunca na URL.
- Cada perfil fica guardado 1 hora na memória do servidor; a Meta limita as chamadas por hora da conta da Vybe.
- As imagens passam pelo servidor (`area=feed_instagram&foto=`), só do CDN do Instagram.

## Sem a Meta: a captura do feed (15/11/2026)

Enquanto o token da Meta não está na Vercel, o Feed usa a **captura**: o perfil público de cada cliente lido uma vez no
navegador da Vybe (cabeçalho e os 12 primeiros quadros, reduzidos a 360 px). As imagens ficam no banco
(`vybe_feed_captura` e `vybe_feed_captura_imagem`, criadas sozinhas na primeira chamada), porque o endereço do CDN do
Instagram vence. Na tela, o que a Vybe publica depois da data da captura entra na frente dos posts capturados; o que o
cliente postar por conta própria só aparece numa nova captura (ou com a Meta ligada, que passa na frente da captura).

- Código: `server/instagram-captura.js`; gravar é `POST /api/painel?area=feed_instagram` com `{ acao: 'captura', perfil }`,
  só os donos. A imagem sai em `GET ...&captura=<usuario>&img=<foto|código>`.
- O cabeçalho guardado não leva quem segue a conta que capturou ("Seguidores: fulano...") nem botões e destaques.
