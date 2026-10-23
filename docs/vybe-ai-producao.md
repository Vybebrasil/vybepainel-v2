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
