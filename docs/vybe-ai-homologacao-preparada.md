# Homologação preparada — Vybe AI completa

Escopo operacional amplo aprovado preservado. Esta revisão não altera as permissões das telas, não ativa envio WhatsApp e não publica em produção. Bot Windows intacto, SIMULACAO=true obrigatório.

## Validação local de 24/10/2026

- OS geral: 755 testes aprovados, zero falhas. Inclui os casos da Vybe AI e as regressões de Windows.
- Sintaxe/ordem global e build aprovados. Catálogo compatível, 15 ferramentas.
- A ponte foi validada com funções reais dos dois projetos e fontes/transporte fictícios, nos 13 módulos autorizados.
- Não houve testes em banco real, WhatsApp, Google ou Meta. Testes não equivalem a uma validação visual manual ou ao piloto real.

As três falhas anteriores eram causadas por CRLF: comparação das cenas geradas e extração de funções nos testes de mapa/foto. O gerador preserva a quebra do checkout; os testes normalizam a leitura. Nenhuma cena ou função de renderização foi alterada. A regressão adicional comprova que uma cena diferente continua falhando e que --conferir não grava arquivos.

## Condições antes de qualquer push

A revisão companheira do Hub remove uma senha PostgreSQL versionada dos leitores, scripts e bundle. O histórico antigo continua contendo a senha. A remoção do código não revoga a credencial; sua rotação/revogação e a conferência das variáveis exigem etapa autorizada no provedor e na Vercel, sem mudanças em produção nesta tarefa.

A conexão Vercel desta sessão não retornou projetos acessíveis para inspecionar os metadados; não foi possível confirmar presença/destino das variáveis. Não presumir ausência nem adequação das configurações. Não foram lidos valores ou alteradas variáveis.

## Sequência de publicação, somente após autorização

1. Confirmar no provedor e na Vercel os consumidores da senha antiga, tratar rotação/revogação com autorização específica e conferir configurações exclusivas de homologação. Não fazer alterações em produção nem testar a senha exposta para descobrir se ainda funciona.
2. Verificar histórico remoto de codex/vybe-ai-metricas. Se divergir do commit-base revisado, parar. Com avanço normal e autorização, enviar somente o commit Hub àquela branch, sem force push. Aguardar CI e Preview READY no SHA correto, sem promover para Production.
3. Conferir no Hub Preview DATABASE_URL, VYBE_OS_DATABASE_URL (se o leitor legado for utilizado), VYBE_AI_METRICAS_ATIVA e VYBE_OS_METRICAS_TOKEN. Não copiar valores para o Windows nem usar o token do bot nessa ponte. Qualquer alteração de configuração permanece dependente de autorização.
4. Preparar/conferir no OS Preview VYBE_AI_HUB_URL apontando para o Hub Preview READY, mapa exato de clientes, segredo dedicado correspondente e flags de homologação. Não alterar Production.
5. Verificar histórico remoto de feature/vybe-ai-readonly-integration e enviar somente o commit OS autorizado, sem merge/force push. Aguardar CI e Preview READY no SHA correto.
6. Revalidar o banco isolado pelo diagnóstico seguro existente e executar testes HTTP negativos sem credencial/contexto válido. O teste positivo com contexto WhatsApp recente deve usar o conector atualizado, não um contexto inventado por um script. Não apresentar ausência de configuração como dados vazios bem-sucedidos.
7. Somente após os dois servidores validados, aplicar os arquivos revisados no Windows preservando sessão, dependências, credenciais, ledger e lock. Reiniciar apenas com autorização específica e uma única instância.
8. Testar Fases 1/2/3 e o fluxo positivo OS → Hub no CMD com o contexto legítimo coletado pelo conector, mantendo SIMULACAO=true e sem envios, novas vinculações ou alterações de dados desnecessárias. Validar cliente divergente, falha da fonte, paginação e módulos autorizados.

Nenhum comando de push/deploy, migração, mudança de banco real, rotação, configuração ou permissão foi executado na preparação local.

Durante a troca de versão na homologação, não testar perguntas naturais com o conector antigo após o OS novo: o catálogo passa de 11 para 15 ferramentas. A atualização coordenada do Windows é necessária para o piloto completo. Não iniciar outra sessão para antecipar testes, nem fabricar participantes/contextos de uma conversa real.
