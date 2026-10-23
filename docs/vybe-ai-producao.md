> Escopo atualizado: a política operacional ampla está em `docs/vybe-ai-operacional.md`. As referências abaixo à restrição original ao executor descrevem a etapa anterior e não limitam as novas ferramentas. As condições de backup, aprovação e desligamento continuam válidas.

# Vybe AI — prontidão do PR #357 para produção

Estado: preparado para revisão; merge, migração e ativação exigem aprovação final de Paulo. Nenhuma dessas ações está autorizada por este documento.

## Integração única

Usa Conta & Equipe → Perfil, sessão individual existente e `/api/painel?area=assistente`. Usuários, clientes e demandas são as tabelas atuais do Vybe OS. Não cria outro cadastro, carteira, editor, jogo ou API paralela. A branch já contém `origin/main` a522d73 (conferência em 23/10/2026).

## Ativação controlada

- `VYBE_AI_ATIVA`: ausente ou diferente de `1` desliga consultas e confirmação do bot e emissão de códigos. Produção deve começar ausente ou `0`.
- `VYBE_AI_PESSOAS_LIBERADAS`: IDs internos separados por vírgulas. Lista vazia não libera ninguém; não há curinga nem exceção administrativa. Só deve receber participantes aprovados para piloto.
- Status e revogação continuam acessíveis pela sessão da própria pessoa mesmo com a integração desligada.
- Retirar ID da lista bloqueia a próxima consulta e confirmação. Configurações de ambiente só chegam a novos deployments: emergência exige desativar e reimplantar, ou revogar o vínculo pela sessão atual.
- Não ativar nem mesmo em Preview nesta etapa sem aprovação. O novo Preview verifica o comportamento desligado; a suíte de integração usa configuração fictícia ativa e verifica todo o fluxo em PostgreSQL isolado.

## Migração revisada, pendente em produção

Única migração desta integração: `migrations/2026-10-23-assistente-vinculos.sql`.

Cria `vybe_ai_vinculos` e `vybe_ai_desafios`, índices e FK para `vybe_pessoas(id BIGINT)`. Não altera pessoas nem demandas existentes. Guarda hashes de JID e código, expiração e revogação, sem telefone/código em texto. DDL idempotente testada duas vezes em PostgreSQL; estrutura aplicada e fluxo HTTP validados no Neon isolado anteriormente.

Antes de execução aprovada: confirmar database/endpoint principal e backup, inspecionar tabelas/constraints existentes e possíveis conflitos de schema. `IF NOT EXISTS` não corrige uma tabela preexistente incompatível. Aplicar arquivo numa transação e conferir FK/índices. Esta migração não está ligada automaticamente ao deploy. Não executar scripts de seed ou preparação de homologação em produção.

## Credenciais e configuração de produção — pendentes

Não foi gerada nem configurada credencial nesta etapa. Após aprovação, o operador gera um token aleatório exclusivo (32 bytes, 64 caracteres hex), guarda fora de código/logs e sincroniza o mesmo valor no Windows e em `VYBE_AI_BOT_TOKEN` com escopo somente Production. Não reutilizar Preview, sessão, portal ou outras chaves.

`VYBE_AI_LINK_SECRET` de produção deve ser exclusivo, aleatório e estável (mínimo 32 caracteres), nunca distribuído ao bot. Não copiar homologação; sua definição exige etapa própria aprovada. Trocar esse segredo invalida a resolução dos vínculos existentes e códigos pendentes. Manter `DATABASE_URL` de produção intacto; overrides de Preview continuam no banco isolado. Não copiar tokens em PRs ou comandos com argumentos visíveis.

## Autorização e limites

Bot aceita apenas consultas enumeradas: `minhas_demandas` e confirmação de código. Identidade vem do JID protegido e vínculo ativo; `pessoa_id` e `admin` enviados pelo bot não concedem acesso. Pessoas inativas ou sem acesso são recusadas. Consulta retorna somente demandas não removidas em que a pessoa é responsável, até 50, com clientes relacionados sem duplicar. Não concede visão administrativa, carteira de head ou acesso a todas as demandas do cliente. Este escopo conservador não cobre ainda novas consultas por cliente ou relatórios gerenciais.

Códigos: dez minutos, uso único, até três por hora, serializados por pessoa; revogação invalida os pendentes. Não há transferência automática de um WhatsApp entre titulares.

## Verificação e riscos

Suíte cobre migração/FK, autenticação, permissões, dados de outro funcionário, clientes múltiplos, expiração, consumo concorrente, revogação, ativação e lista do piloto. O fluxo HTTP completo passou no Preview anterior usando somente contas fictícias. A conta manual de homologação não deve ser usada por testes automatizados.

Riscos operacionais antes de ativar: sincronizar token e URL do bot local, confirmar que códigos são tratados somente em conversa privada, impedir que conteúdo de demandas seja interpretado como instrução pelo Qwen, não registrar payloads/códigos, evitar respostas de funcionários em grupos e validar revogação real no WhatsApp. O conector Windows/Ollama não está neste PR e não foi auditado por esta revisão; não afirmar validação dele ou de mídia/voz. Escritório, Vybelândia e jogos preservados por regressões automatizadas; não houve revisão visual completa nesta etapa.

Rollback: desligar integração e reimplantar, manter tabelas/vínculos para auditoria e revogação; não apagar registros nem reverter migração automaticamente. Não requer desfazer funcionalidades do Vybe OS.

## Parecer de segurança antes da autorização de produção — 23/10/2026

### Evidências desta revisão

PR aberto, sem merge: commit `20c3492d75dc245e8885bd348a4011dd8c7c33d4`, main `a522d73`. CI anterior do mesmo commit: 645 testes aprovados; nenhuma mudança funcional nesta revisão.

Inspeção do Neon principal realizada em transação **somente leitura**, sem consultar conteúdo de funcionários: `vybe_pessoas.id` confirmado BIGINT; `public.vybe_ai_vinculos` e `public.vybe_ai_desafios` ausentes. Flags `VYBE_AI_ATIVA` e `VYBE_AI_PESSOAS_LIBERADAS` ausentes em Production. O código exige flag exatamente `1` e IDs explicitamente liberados; nenhuma configuração de Preview é assumida em Production.

A migração só contém CREATE TABLE/INDEX IF NOT EXISTS. Cria também sequências implícitas dos BIGSERIAL, constraints e referências às pessoas existentes. Não contém DROP, ALTER, TRUNCATE, DML, GRANT, REVOKE ou alteração de papéis. Não cria nem remove usuários/permissões administrativos. As novas tabelas recebem owner e privilégios padrão do papel executor; os padrões de ACL foram inspecionados, sem alterações. A aplicação continua responsável pela autorização: não se deve distribuir a conexão do banco ao bot.

As FKs usam ON DELETE CASCADE: excluir uma pessoa no futuro excluirá seus próprios vínculos/desafios, sem apagar pessoas ou demandas. A criação de FK pode adquirir bloqueios transitórios na tabela referenciada; executar em janela acordada com lock_timeout curto e abortar em contenção. A migração não vem envolvida em BEGIN/COMMIT no arquivo: o executor deve garantir a transação. Não executar automaticamente por build/deploy; a configuração atual não a executa.

### Backup e recuperação — bloqueio ainda aberto

A API disponível da integração Vercel não forneceu a janela configurada de recuperação do Neon principal. Não há evidência revisada de backup completo recente com restauração ensaiada. Os dumps locais de schema e referências usados para homologação **não são backup integral** e não comprovam recuperação dos dados operacionais.

Antes da migração, o responsável pelo Neon deve registrar: projeto/branch principal corretos; janela de histórico realmente configurada e ponto mais antigo restaurável; data UTC/LSN do ponto pré-migração; responsável com acesso à recuperação; destino seguro do backup; evidência de restauração em ambiente separado. Não inferir capacidade pelo plano. Se a janela for zero, não existe recuperação pontual por histórico. O backup externo deve ser completo, protegido, com integridade verificada e restauração ensaiada; não armazenar dados reais no repositório ou no banco fictício de homologação.

O ensaio de restauração com dados reais exige autorização própria e destino restrito. Não foi executado nesta revisão. Definir RPO (perda máxima de dados) e RTO (tempo máximo de recuperação) aceitos; ambos ainda sem comprovação. Um rollback da aplicação não precisa de restauração global do banco. Restaurar o banco inteiro pode perder alterações legítimas de todos os módulos posteriores ao ponto escolhido.

Referências oficiais: [janela de histórico](https://neon.com/docs/postgres/backup-restore/history-window), [recuperação pontual](https://neon.com/docs/postgres/backup-restore/branch-restore) e [backup com pg_dump](https://neon.com/docs/manage/backup-pg-dump). A configuração efetiva do projeto ainda precisa de evidência.

### Ordem segura das operações (somente após autorizações)

1. Congelar o commit revisado e confirmar novamente main, CI e diff. Registrar autorização específica para merge, migração e eventual piloto; uma não autoriza automaticamente as demais.
2. Parar o conector; manter SIMULACAO=true. Confirmar flags de Production ausentes/0 e lista vazia. Não alterar DATABASE_URL nem aproveitar segredos de homologação.
3. Confirmar backup/recuperação descritos acima. Sem evidência, interromper antes de qualquer migração.
4. Com merge aprovado, integrar o PR e conferir o deployment de Production: funções existentes, login/Conta, demandas, Escritório e jogos. A IA deve continuar desativada, sem gerar códigos. Credencial ausente pode responder 401 antes da trava; com credencial válida, desligada responde 503. Não interpretar 401 como prova de que a trava foi exercitada.
5. Com migração aprovada, usar conexão direta autorizada para o principal e executar o arquivo em transação única, com ON_ERROR_STOP, lock_timeout de 5 segundos e statement_timeout de 60 segundos. Esses limites são ponto de partida: timeout aborta, não justifica remover limites ou repetir cegamente. Não executar seeds ou scripts de preparação de homologação.
6. Conferir tabelas, índices, FK/uniqueness, CHECK de expiração e privilégios das novas estruturas. Verificar ausência de alterações de schema/ACL nos objetos anteriores. Não exigir igualdade de contagens operacionais sob uso concorrente; a prova de não alteração vem da revisão SQL e transação/auditoria. Registrar resultado sem payloads ou segredos.
7. Provisionar credenciais exclusivas de produção somente com autorização. Armazenar token do bot no Windows e Vercel pelo canal seguro, segredo de vinculação apenas no servidor. Produção permanece desativada. Novo deployment para absorver configuração.
8. Resolver auditoria do conector abaixo e ensaiar em homologação: emissão, confirmação privada, consulta restrita, tentativa de acesso alheio, código expirado/reutilizado e revogação, sem usar dados reais ou a conta manual para automação repetitiva.
9. Somente com autorização explícita de ativação: liberar IDs do piloto, ativar, implantar e validar com participantes consentidos. Conferir consultas próprias, bloqueio imediato após revogação e ausência de grupos/duplicatas/logs sensíveis. Não liberar toda a equipe por padrão.
10. Acompanhar erros por status/etapa e latência, sem registrar código, JID, token, prompts ou respostas. A expansão depende de nova avaliação do piloto.

### Reversão

- Antes do COMMIT da migração: erro/timeout => ROLLBACK e interromper; não continuar uma transação abortada.
- Depois do COMMIT: parar o bot, desligar flag e reimplantar; se necessário retornar ao deployment conhecido do Vybe OS. Preservar tabelas da IA e vínculos para investigação/revogação; não usar DROP nem restaurar todo o banco apenas para retirar a integração.
- Em incidente de credencial: interromper o bot e substituir/revogar a credencial comprometida com autorização e novo deployment. Não trocar LINK_SECRET como botão de desligar: ele afeta a identidade de todos os vínculos.
- Restauração pontual do banco é último recurso, com análise do impacto em todos os módulos, ponto confirmado, preservação do estado atual e autorização específica. Ensaiar primeiro num destino separado; não trocar endpoint de produção automaticamente.

### Conector Windows/Ollama — informado pelo usuário, não auditado

Local exclusivo `C:\whatsapp-ia`, arquivos `bot.js` e `vybe-api.js`, Node.js 24, whatsapp-web.js, Ollama/qwen3.5:35b-a3b. Usuário informa SIMULACAO=true, comando !vybe funcionando pelo próprio número, oito grupos reconhecidos, vínculo completo ainda não implementado e respostas automáticas não liberadas. Não foram recebidos arquivos nem credenciais; essas condições são relato, não verificação do código.

Pendências obrigatórias antes de ativar:

| Área | Critério de aceite e teste |
| --- | --- |
| Mensagens próprias | Separar comando intencional do operador das mensagens enviadas pelo bot. Provar que envio/resposta do bot não reentra no handler. Se comandos próprios forem permitidos, restringir a caminho explícito autenticado de teste/conversa consigo mesmo; não usar fromMe como acesso administrativo genérico. Testar eco, reconexão e eventos disparados pelo próprio envio. |
| Conversas privadas | Consultas pessoais e códigos apenas em chat privado. Recusar grupos, listas/status e conteúdo encaminhado como código de terceiros. Oito grupos reconhecidos não concedem autorização. Provar que !vybe em grupo não consulta nem divulga dados pessoais, inclusive quando a mensagem é do próprio operador. |
| Identidade | Derivar JID do remetente da plataforma, normalizado para os formatos aceitos. Nunca de texto, pessoa_id, nome ou resposta do Qwen. Não confundir @lid com telefone; não substituir indiscriminadamente sufixos. A API confia no conector autenticado para informar JID: token roubado permite tentar representar qualquer vínculo, portanto este é um limite de confiança crítico. |
| SIMULACAO | Demonstrar ausência de envios automáticos, inclusive nos caminhos de erro, sucesso de vínculo e retry. O flag informado não foi inspecionado. |
| Logs e arquivos | Nunca imprimir Authorization, códigos, JIDs/telefones, prompts, respostas ou cookies/sessão. Sanitizar exceções de HTTP/biblioteca e stdout/stderr do Ollama. Proteger token e sessão WhatsApp com ACL; excluir de Git, backups informais e compartilhamentos. |
| Duplicatas | Uma única instância ativa; chave durável por conta/chat/message-id com operação atômica, antes de chamar API/modelo. Deduplicar eventos repetidos, reconexão, reinício, duas chamadas concorrentes e mensagens originadas pelo bot. Fila por conversa e estados recebido/processando/enviando/enviado; não apenas Set em memória. |
| Envio incerto | Se envio foi aceito mas houve timeout/queda antes de marcar enviado, não reenviar cegamente. Guardar identificação de saída quando disponível e tratar estado ambíguo para revisão. Deduplicação de códigos no servidor não garante resposta WhatsApp exatamente uma vez. |
| Limites e falhas | Timeout para API/modelo, tamanho de entrada/saída e fila, limite por remetente, backoff limitado. Sem retry de 401/403/429 como se fosse erro transitório. Não transformar erro/indisponibilidade em resposta de sucesso ou dados de outro usuário/cache compartilhado. A API atual não inclui rate limit geral de consultas/tentativas de confirmação; três códigos/hora limita emissão, não tráfego ou tentativas do bot. |
| Ollama e Qwen | Serviço acessível só no contexto local necessário; token nunca no prompt. Texto do usuário e das demandas é dado não confiável; modelo não escolhe JID, permissão, URL nem SQL e não executa ferramentas/comandos. Evitar memória/cache compartilhado entre funcionários. Código de vínculo deve seguir caminho determinístico antes do Qwen. |
| Validação final | Dois funcionários distintos, consulta alheia, revogação, mensagens próprias, grupos, eco, duplicatas simultâneas, reinício e timeout ambíguo; nenhum segredo nos logs. Primeiro com dados fictícios e depois piloto autorizado. |

### Conclusão

**Candidato apto para merge desligado, sujeito à aprovação; NÃO apto para migração/ativação irrestrita neste momento.** A migração é aditiva e compatível com a chave real, e o servidor tem trava explícita e autorização conservadora testada. Bloqueios operacionais: backup/recuperação principal sem evidência e conector não auditado, além das credenciais/piloto ainda pendentes. Nenhum merge, migração, backup completo, ensaio com dados reais ou ativação foi executado nesta revisão.
