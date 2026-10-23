# Vybe AI — integração segura com WhatsApp local (proposta)

Status: **proposta de arquitetura, sem ativação em produção**. Escopo inicial: perguntas em linguagem natural sobre demandas, prazos e equipe, com dados atuais do Vybe OS, sem escrita.

## Arquitetura confirmada
- Neon/PostgreSQL é a fonte oficial de dados operacionais; Drive armazena arquivos (README.md).
- APIs existentes estão em `api/painel.js`, `api/conteudo.js` e serviços em `server/`.
- `vybe_acesso.js` aceita cookie de sessão assinada ou `MIRROR_ADMIN_KEY`. **A chave administrativa não pode ser usada pelo bot.**
- `api/sessao.js` identifica a pessoa logada e verifica sessão. As regras específicas de permissão precisam ser reutilizadas na API.
- Há limites de quantidade de funções Vercel descritos em `api/painel.js`. Avaliar roteamento no endpoint existente, em vez de criar endpoint adicional.
- Não reativar Monday, réplicas ou webhooks legados. Preservar semântica de status e datas.

## Contrato inicial proposto (ainda não implementado)
`POST /api/painel?area=assistente` com JSON `{ "consulta": "minhas_demandas" | "prazos" | "equipe", "filtros": {...} }`, sempre leitura.

**Autenticação**: credencial exclusiva da integração, guardada apenas no servidor local e em variáveis de ambiente da Vercel; autenticação restrita da máquina chamadora, com expiração/rotação e sem reutilizar `MIRROR_ADMIN_KEY`. Não enviar credenciais ao modelo de linguagem.

**Identidade da pessoa**: mapear uma conta interna ativa a um identificador WhatsApp vinculado e verificado (incluindo formatos @lid e @c.us), com opt-in e revogação; **não autorizar alguém apenas porque participa de um grupo**. Vinculação deve ser revisada por administrador. O servidor revalida a conta e seus privilégios em toda consulta.

**Permissões**: implementar com o mesmo modelo de autorização por pessoa já usado no painel. Em grupos, limitar os resultados ao que todos os participantes previstos para aquele canal estão autorizados a ver, ou exigir conversa privada. Conteúdo de Diretoria, financeiro, credenciais e dados pessoais não deve ser apresentado em grupo por padrão.

**Consultas**: parâmetros enumerados, limite de resultados, datas validadas em `America/Bahia`, SQL parametrizado, retorno mínimo `{ itens, atualizado_em, fonte, filtros_aplicados }`; não oferecer SQL livre. Respeitar status Finalizado/Para agendar/Agendado e diferença entre prazo, veiculação e conclusão.

**Camadas**: WhatsApp (gatilho `!ia`) → verificação de ID/usuário → Node.js local (fila/rate limiting) → API de leitura Vybe → dados autorizados → Qwen/Ollama → resposta. O modelo nunca escolhe as próprias permissões nem chama URLs arbitrárias. O texto do cliente/usuário e dos itens do banco é dado não confiável, não instrução de sistema.

## Regras obrigatórias antes de liberar
1. Corrigir/revisar o `npm audit` do projeto de WhatsApp e os riscos da biblioteca não oficial; manter número de testes, modo simulação e gatilho explícito.
2. Confirmar autorização e escopo de cada usuário; negar usuários bloqueados, sem vínculo ou com papel alterado.
3. Responder 401/403 para credencial inválida/permissão insuficiente, sem retornar dados ou inferir sua existência.
4. Não armazenar conteúdo integral de conversas ou chaves nos logs; proteger armazenamento de sessão LocalAuth.
5. Configurar timeout, rate-limit, limite de mensagens, auditoria sem conteúdo sensível e prevenção de duplicatas.
6. Não expor endpoints de escrita; qualquer evolução exigirá revisão separada e confirmação humana.
7. Testar com banco PGlite/dados fictícios no ambiente de desenvolvimento. Não habilitar `VYBE_DEV_ALLOW_WRITES` nem usar produção nos testes.
8. Verificar `npm run check`; revisar branch atual contra `origin/main` antes de mesclar.

## Testes de aceitação propostos
- Usuário ativo e vinculado enxerga somente suas demandas permitidas.
- Usuário de outro setor recebe lista filtrada, não dados protegidos.
- Usuário desligado/bloqueado perde acesso na próxima consulta.
- Identificador `@lid` não se confunde com `@c.us` sem vinculação validada.
- `!ia` fora de grupo permitido não consulta o Vybe OS.
- Instrução maliciosa dentro de título/briefing não altera permissões ou ações.
- Limite/paginação, datas e múltiplos clientes associados produzem contagens corretas.
- API indisponível gera erro explícito, nunca resposta inventada ou lista vazia apresentada como verdade.

## Passos seguintes
- Mapear handlers de leitura existentes e a aplicação real das permissões por pessoa.
- Validar o cadastro/associação dos usuários WhatsApp, sem guardar números em código.
- Implementar contrato mínimo de uma consulta (`minhas_demandas`) e testes em branch, revisando antes de ampliar.
- Conectar a API ao `bot.js` local, mantendo `SIMULACAO=true`.

## Preview de homologação

O repositório utiliza `scripts/vercel-construir.mjs`: previews são construídos somente quando a mensagem do commit inclui `[preview]`. A implantação de teste não autoriza executar migrações no banco de produção nem cadastrar credenciais sem revisão. Verificar acesso público, autenticação e build antes de quaisquer consultas com dados reais.

## Diagnóstico confirmado — 23/10/2026

- Na branch `feature/vybe-ai-readonly-integration`, o Preview herda a mesma
  `DATABASE_URL` global de Production. Os overrides de banco encontrados são
  de outras branches. Este ambiente **não é banco isolado**.
- SELECT de `information_schema.columns` confirmou `vybe_pessoas.id` bigint,
  `ativo`/`pode_entrar` boolean, `senha_hash` text e datas de demanda compatíveis.
  As duas tabelas `vybe_ai_vinculos` e `vybe_ai_desafios` não existem ali.
- A consulta real de `pessoaVinculada`, com hash fictício, retornou SQLSTATE
  `42P01`, `relation "vybe_ai_vinculos" does not exist`. Portanto o 503 vem
  da resolução do vínculo, antes de executar `minhasDemandas`, e não da
  autenticação do bot. Não se deduziu a causa apenas do HTTP 400 do Neon.
- Sem a tabela, não há conta WhatsApp vinculada possível: a consulta verifica
  `to_regclass` antes de referenciar a relação e nega com 403 e
  `Conta WhatsApp não vinculada.`. Erros de conexão, coluna, permissão ou
  outros SQLSTATE continuam produzindo 503; não são convertidos em lista vazia.
- A migração foi revisada e aplicada duas vezes em PostgreSQL local (PGlite),
  com tipos compatíveis com os metadados reais. FK, expiração e índices foram
  exercitados com identidades fictícias. Não foi aplicada no banco da Vercel.
- O handler existente do bot foi movido para `server/assistente-servico.js`,
  mantendo o mesmo endpoint e a mesma autenticação; a injeção do banco permite
  testar autenticação → vínculo → consulta com SQL real isolado.
- Testes cobrem token inválido, conta desconhecida, grupos, identidade forjada
  no corpo, sessão/origem na emissão, rate limit de emissão, hash do código,
  prazo de dez minutos, consumo único concorrente, bloqueio, revogação,
  remoção e múltiplos clientes sem duplicar demandas. Nenhuma permissão admin
  é criada ou alterada e nenhuma consulta de funcionário real foi feita.
- A Vercel não devolve o valor do token marcado como sensível. A validação
  remota autenticada deve ser feita pelo bot já configurado, sem compartilhar
  token: POST no Preview, consulta `minhas_demandas`, JID fictício
  `99999999999999999999@lid`. Esperado: 403 com a mensagem acima.

### Para avançar na vinculação real

Primeiro configurar um banco **isolado** para esta branch de Preview e aplicar
ali a migração. A aplicação em Production exige autorização própria. Até isso
acontecer, emissão/consumo não estão homologados contra o banco remoto; o 403
não significa que a vinculação já está provisionada. Não usar código de vínculo
ou identidade real para testar no Preview atual, pois ele compartilha o banco.

## Conta & Equipe → Perfil: Vybe AI — WhatsApp

A seção reutiliza a sessão pessoal do Perfil e `area=assistente`. Não usa token
administrativo no navegador, nem recebe pessoa_id para escolher o titular:

- GET `consulta=vinculacao_status`: disponibilidade da estrutura e estado do
  vínculo da própria sessão, sem retornar telefone, JID ou hash.
- POST `consulta=vinculacao_iniciar`: código de uso único, dez minutos e até
  três emissões por hora. O código fica só em memória na tela; não vai para
  localStorage. A pessoa copia e envia apenas na conversa privada com o bot.
- POST `consulta=vinculacao_revogar`: revoga todos os vínculos da própria
  pessoa e invalida todos os códigos pendentes na mesma transação. Exige
  sessão pessoal e mesma origem, como a emissão. Não exige LINK_SECRET para
  permitir revogar um vínculo mesmo se a configuração de emissão falhar.
- Emissão, confirmação e revogação serializam por pessoa usando a transação
  existente do Vybe OS. Reconexão de JID revogado é permitida somente para o
  mesmo titular, com código novo; não transfere o WhatsApp para outra pessoa.
- A tela distingue erro de rede, indisponibilidade da estrutura, não vinculado
  e vinculado. Conferência é manual, sem polling permanente. Revogação com
  erro preserva o estado exibido e informa a falha.

A estrutura continua ausente no Preview compartilhado: a seção aparece como
indisponível até provisionar um banco isolado e aplicar ali a migração. Não foi
alterado o banco remoto. Para fechar a homologação: testar em conta fictícia no
banco isolado, enviar código no privado ao bot, conferir vínculo, consultar
minhas_demandas e revogar; a consulta seguinte deve negar acesso. A inspeção
visual automática permanece bloqueada, portanto testes de HTML não equivalem
à aprovação visual no navegador. Escritório/jogos não foram editados.

## Homologação Neon isolada — preparação de 23/10/2026

Foi criado o recurso **vybe-ai-homologacao**, plano Free, região gru1,
projeto Neon `blue-pine-55207839`, separado de `bold-silence-70503527`.
O schema público foi exportado com `pg_dump --schema-only` e
`default_transaction_read_only=on` na origem, e restaurado no destino novo e
vazio. São 91 tabelas antes da migração da Vybe AI. Também foram copiadas
somente configurações de status, preços, regras e catálogo do Escritório;
pessoas, clientes, demandas, conversas e históricos reais não foram copiados.

A migração `2026-10-23-assistente-vinculos.sql` foi aplicada **apenas no Neon
isolado**. Duas contas não administrativas com e-mails em `vybe.invalid`,
um cliente fictício e duas demandas próprias foram preparados. A conexão
principal e as permissões de funcionários reais não foram modificadas.

A branch `feature/vybe-ai-readonly-integration` tem overrides exclusivos de
Preview para `DATABASE_URL`, `VYBE_HOMOLOGACAO`, `SESSAO_SECRET`,
`VYBE_AI_BOT_TOKEN` e `VYBE_AI_LINK_SECRET`. Segredos são próprios da homologação,
sem valores no Git, argumentos de shell ou relatórios. O recurso foi conectado
com prefixo `VYBE_AI_HOMOLOG_`, sem substituir a configuração global de banco.
Overrides só entram em deployments novos; previews antigos continuam com sua
configuração anterior e não devem ser usados para testar escrita.

### Roteiros reproduzíveis

- `scripts/assistente-homologacao.mjs` bloqueia banco com mesmo endpoint de
  produção (inclusive pooled/unpooled) e URLs HTTP de produção.
- `scripts/assistente-preparar-homologacao.mjs` exige `VYBE_HOMOLOGACAO=1`, as
  conexões separadas em `VYBE_AI_PRODUCAO_DATABASE_URL` e
  `VYBE_AI_HOMOLOG_DATABASE_URL`, e senha de teste em `VYBE_AI_HOMOLOG_SENHA`.
  Recusa banco com pessoas fora das duas contas fictícias. Aplica a migração e
  prepara somente os registros de teste, sem mudar administradores.
- `scripts/assistente-testar-preview.mjs` usa essas mesmas variáveis, mais
  `VYBE_AI_HOMOLOG_PREVIEW`, `VYBE_AI_BOT_TOKEN` e `VYBE_AI_LINK_SECRET`. Testa
  login, geração, vínculo, consulta própria, identidade forjada no corpo,
  bloqueio, códigos expirados/reutilizados, revogação e invalidação de pendentes.
  Ao final verifica as APIs de entrada, mapa, economia/conquistas, ranking e
  lobby do Escritório. Não envia mensagens reais ao WhatsApp nem valida mídia.

Não usar o token de homologação no bot de produção. Para testar o conector local,
configurar uma instância de teste com o URL e token desta branch por canal seguro;
o código recebido no privado deve ser consumido antes de chamar o Qwen. O modelo
não escolhe JID/pessoa nem recebe os segredos. Evidências finais de HTTP e CI
ficam no PR #357; testes de API não equivalem à inspeção visual de todos os jogos.
