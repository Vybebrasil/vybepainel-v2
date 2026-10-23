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
