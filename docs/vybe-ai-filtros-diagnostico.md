# Filtros e diagnóstico — revisão local de 24/10/2026

Branch: `feature/vybe-ai-readonly-integration`. Base do conector: arquivos atuais
recebidos do Windows, incluindo LID, fallback de metadados, trava e projeções de
prévia. Nenhum bot foi iniciado e não houve push, deploy, merge, migração ou acesso
a dados reais nesta revisão.

## Critérios implementados

A ferramenta existente `minhas_demandas` mantém identidade derivada exclusivamente
do vínculo autenticado. Recebe `periodo` (`hoje`/`todas`), `situacao`
(`todas`/`pendentes`/`atrasadas`), limite e deslocamento. `buscar_demandas` reutiliza
a mesma consulta e aceita `situacao` para equipe autorizada.

- Hoje: `COALESCE(prazo, veiculacao)` no dia do servidor, America/Bahia.
- Pendente: status oficial relacionado pelo quadro e chave, com `final IS FALSE`.
- Atrasada: pendente e `prazo < hoje`. Sem prazo não entra, mesmo com veiculação antiga.
- Concluída: flag oficial `vybe_status.final`, não aproximação textual de rótulos.
- Sem correspondência de status: aparece em todas, mas não em pendentes/atrasadas;
  ausência de classificação não comprova nenhum desses estados.
- Limite 25, paginação e identidade continuam validados no servidor. Removidas ficam fora.

Referências consultadas: `server/escritorio-dia.js` usa `vybe_status.final`;
`scripts/assistente-preparar-homologacao.mjs` já depende dessa coluna.
O painel legado tem também listas de rótulos e o Dia da equipe usa veiculação como
fallback de atraso. Não alteramos essas telas nem afirmamos que os critérios são
idênticos: para esta consulta, atraso significa prazo vencido. Nenhuma enumeração
atual dos rótulos do banco remoto foi consultada nesta etapa.

## Perguntas de referência

| Pergunta com !vybe | Período | Situação | Caminho |
| --- | --- | --- | --- |
| minhas demandas | todas | todas | pessoal, sem Qwen |
| minhas demandas de hoje | hoje | todas | pessoal, sem Qwen |
| minhas demandas pendentes | todas | pendentes | pessoal, sem Qwen |
| minhas demandas atrasadas | todas | atrasadas | pessoal, sem Qwen |
| minhas demandas pendentes de hoje | hoje | pendentes | pessoal, sem Qwen |
| minhas demandas amanhã/semana/concluídas | — | — | recusado, diagnóstico fixo de filtro não suportado |

O reconhecedor não é um interpretador completo de português. Novos recortes devem
ser adicionados ao contrato e aos cenários, sem prometer compreensão universal.
Consultas gerais continuam com Qwen e catálogo autorizado.

## Diagnóstico sem conteúdo

`diagnostico.js` aceita apenas categorias fixas: autenticação, autorização, HTTP,
timeout/rede da API, formato da API, HTTP/timeout/indisponibilidade do Ollama,
modelo vazio/inválido, ferramenta desconhecida, argumentos rejeitados, limites de
tempo/ferramentas/contexto/rodadas e formatação. Erro inesperado vira INTERNO.
Nunca imprimir mensagem/stack do erro, prompt, resposta, argumentos, identidade ou token.

O console não recebe mais a prévia operacional. `VYBE_PREVIA_LOCAL=1` mantém a
opção de arquivo local privado exclusivamente para teste da própria conta;
por padrão nada é salvo. Usar dados fictícios e ACL Windows. Callbacks de prévia
são explícitos para testes. Não houve habilitação de envio.

## Conhecimento do modelo e limites

`fluxos.js` fornece regras versionadas sobre demandas, papéis, datas, captações,
roteiros, planejamento, métricas do VybeHub e análise estratégica. Não substitui
a autorização nem a consulta do servidor. O modelo continua Qwen3.5 pelo Ollama,
com limite de contexto, ferramentas e rodadas, sem memória entre mensagens.

Preservamos a projeção conservadora recebida do Windows: a prévia de linguagem
natural mostra dados estruturados consultados, não o texto livre do Qwen. Análise
estratégica livre ainda exige validação própria antes de expor respostas geradas.

## Próximo teste de homologação

1. Revisar e publicar somente a branch Preview, em uma etapa posterior autorizada.
   O servidor precisa receber o contrato novo; trocar só o bot retorna HTTP 400.
2. Confirmar banco isolado, grupos aprovados e ativação de teste controlada conforme
   configuração já existente. Nenhuma variável foi alterada nesta entrega.
3. Com conta fictícia vinculada, comparar as perguntas acima com dados de teste.
4. Testar Node 24 no Windows, LID real, fallback de grupos, reconexão, revogação e
   deduplicação. Testes locais simulam WhatsApp/Ollama e não comprovam execução real.
5. Não substituir sessões, token, ledger, dependências ou arquivos de ambiente.
   Copiar só o código revisado, com o bot parado; não reiniciar automaticamente.

Não há migração nova. Preservados Escritório, Vybelândia, jogos e frontend.

## Resultado da verificação local

- 690 testes da suíte completa aprovados, sem falhas, concorrência limitada a 2.
- 82 testes focados da integração aprovados, incluindo LID, mensagens próprias,
  recortes pessoais, fuso, paginação, autorização e categorias de erro.
- Sintaxe/ordem global de 289 arquivos e build aprovados; diff sem erro de espaços.
- Windows, WhatsApp real e inferência real do Ollama não foram executados.
