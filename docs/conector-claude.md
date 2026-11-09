# Conector "Ecossistema Vybe" (chats do Claude.ai → Vybe OS)

Pedido do Paulo (09/11/2026): os chats de cada cliente no Claude.ai (contas gestaovybe e a segunda conta, as duas no
plano Max) já sabem muito de cada cliente e geram conteúdos, planejamentos e decisões. O que eles fecham precisa entrar
no ecossistema, sem copiar à mão.

## Como funciona

- O Vybe OS expõe um servidor MCP em `/mcp/<chave>` (`server/mcp-ecossistema.js`; rota em `vercel.json` → `api/painel.js`, área `mcp`).
- Cada conta do Claude.ai tem a sua chave, na variável `VYBE_MCP_CHAVES` (`gestao:<chave>,segunda:<chave>`, 24+ caracteres cada).
  Chave errada recebe 404. Para cortar uma conta, troque a chave dela.
- As ferramentas:
  - `listar_clientes`: clientes ativos, com o nome do painel;
  - `consultar_cliente`: cadastro (sem valores), o que falta no cadastro e os 10 últimos registros;
  - `registrar`: grava uma entrega definitiva em `vybe_cliente_registros` e faz uma cópia `.md` no Drive, em
    `<pasta do cliente>/Registros do Claude/`. A pasta do cliente é a ligada no cadastro ou, sem ela, a pasta com o nome do cliente na raiz.
- O nome do cliente tem de bater com um cliente ativo. Se vier errado, o chat recebe a lista e nada é criado.
- O banco é a fonte; o Drive é cópia. Falha no Drive não perde o registro (fica `drive_erro`).
- O conector só lê e acrescenta: não apaga, não muda peça, não fala com cliente, não mostra dinheiro.
- Na ficha do cliente, aba **Cérebro → Registros dos chats do Claude**.

## Ligar

As contas já têm o conector **"Painel Vybe"** (`/api/painel?area=agentes&chave=<AGENTES_CHAVE>`, o dos planejamentos,
`server/planejamentos-api.js`). Desde 09/11 ele também tem `consultar_cliente` e `registrar`, então não é preciso
adicionar outro: basta o "Painel Vybe" estar conectado na conta e o texto abaixo estar nas instruções do projeto.

A rota `/mcp/<chave>` com `VYBE_MCP_CHAVES` é a alternativa, com uma chave por conta (o registro mostra qual conta
gravou). Só é preciso se um dia quisermos separar as contas.

## Texto para as instruções do projeto de cada cliente

```
Você trabalha para a agência Vybe no cliente: [NOME DO CLIENTE COMO ESTÁ NO VYBE OS].

No começo de cada trabalho, use a ferramenta "consultar_cliente" do Ecossistema Vybe para ler a ficha atual.
Toda vez que fechar algo definitivo (conteúdo aprovado, planejamento, roteiro, decisão do cliente, regra de marca
ou aprendizado), use "registrar" com: tipo, título curto, status, resumo (3 a 5 linhas), decisões e regras novas,
próximos passos e, se houver, o conteúdo completo.
Não registre conversa solta, testes ou ideias descartadas.
Se a ferramenta disser que o cliente não existe, use "listar_clientes" e repita com o nome exato.
```

## Histórico já existente

Exportar as conversas (Claude.ai → Configurações → Privacidade → Exportar dados) e importar o `conversations.json`:
próximo passo, ainda não feito.
