# Vybe AI — conector de consultas amplas em simulação

Esta preparação mantém a política operacional ampla aprovada para a equipe: demandas, briefings, comentários, histórico, planejamento, desempenho, ranking, XP, moedas, faturamento de clientes e módulos do VybeHub. Identidade, vínculo e participação nos grupos internos continuam obrigatórios. A política da IA não modifica permissões das telas nem concede poderes administrativos.

## Estado desta integração

Código preparado na branch feature/vybe-ai-readonly-integration, somente no workspace. O bot instalado em C:\whatsapp-ia não foi substituído nem reiniciado. SIMULACAO=true está fixo no código e não existe caminho de envio WhatsApp.

Os fontes ampliados dos dois servidores foram recebidos, conferidos por SHA-256 e integrados nos workspaces. O OS local oferece 15 ferramentas e os filtros situacao/secao/modulo. O Hub local oferece os 13 módulos aprovados, incluindo faturamento. O verificador offline de compatibilidade indica compativel=true. Isso não comprova que as Previews já tenham recebido o código: nenhum push/deploy ocorreu.

Não aplicar o conector instalado antes de publicar e validar os dois servidores compatíveis em uma etapa autorizada. O servidor antigo da Preview ainda não conhece os novos filtros.

## O que foi reaproveitado e preservado

Reutiliza perguntarQwen, catálogo devolvido pelo servidor, autenticação da API, vínculo, grupos aprovados, fotografia completa de participantes e revalidação no fechamento. Preserva LID/telefone somente com equivalência confirmada pela plataforma, fallback de getChat, ID interno da mensagem, LocalAuth, lock, deduplicação, cooldown e leitura compatível dos grupos. A frase pessoal "demandas ... sob minha responsabilidade" também segue o caminho pessoal, sem pedir identidade ao modelo.

Até três chamadas de ferramenta, quatro rodadas, 150 segundos no orquestrador, 16 KB de resultados, contexto 8192 e geração 1024. Sem histórico entre conversas. O modelo não recebe acesso direto a PostgreSQL, terminal ou URL arbitrária. Ferramentas de escrita não fazem parte desta entrega de leitura.

## Prévia e diagnóstico

Após autorização final, consultas pessoais e naturais aparecem em PREVIA_WHATSAPP_SIMULACAO no CMD. A prévia usa resultados autorizados, sem incorporar o rascunho livre do Qwen como evidência. Os campos aprovados incluem nomes operacionais, briefing, comentários, histórico, planejamento e métricas amplas. Credenciais, sessões e segredos técnicos não são campos autorizados.

O pacote recebido desabilitava a prévia padrão e reintroduzia gravação em arquivo. Essas regressões foram corrigidas na preparação. Não há gravação de respostas pela aplicação, mesmo com VYBE_PREVIA_LOCAL=1. Permanecem somente os metadados do ledger e os mecanismos de sessão existentes. Use terminal privado, sem transcrição ou redirecionamento.

Diagnósticos têm categorias fixas, como erro_ARGUMENTOS_REJEITADOS, erro_OLLAMA_TIMEOUT, erro_MODELO_VAZIO e erro_AUTORIZACAO. Não imprimir mensagens brutas de exceção, perguntas, resultados, tokens ou credenciais. O diagnóstico pessoal de quantidade e limite foi preservado.

## Testes sem WhatsApp ou banco real

Node 24: node --test conector.test.js. Os testes usam mensagens, APIs e respostas do modelo fictícias, com SQLite local descartável ou em memória. Importar bot.js não inicializa WhatsApp. Não é necessário instalar novas bibliotecas para essa suíte.

No repositório do OS: node --test tests/assistente-*.test.mjs. O verificador offline node scripts/assistente-verificar-compatibilidade.mjs lista contratos que faltam; saída compativel=false bloqueia a conclusão técnica de integração, não altera autorização de ninguém.

## Ordem de implantação futura, mediante autorização

1. Revisar os diffs já integrados nas branches de desenvolvimento e concluir a validação de cada servidor. O contrato local já é compatível; resolver as pendências de CI registradas no relatório.
2. Publicar primeiro o Hub em Preview. Preparar a ponte entre servidores com credencial própria, correspondência exata de clientes e nenhuma reutilização do token do bot ou cookies administrativos.
3. Publicar o OS compatível em Preview. Revalidar o banco isolado e os vínculos/configurações de homologação; testar o fluxo OS → Hub e os módulos ampliados.
4. Só então aplicar as edições revisadas no Windows, preservando dependências, sessão, credenciais, ledger e lock. Reinício exige autorização específica; não iniciar segunda instância.
5. Validar Fases 1/2 e consultas amplas em simulação, primeiro com dados fictícios. Não gerar códigos nem revincular a conta já vinculada sem necessidade/autorização.

Não foram executados push, deploy, merge, migração, alterações de banco, configuração ou produção. Detalhes de cobertura e dependências: docs/vybe-ai-operacional.md.
