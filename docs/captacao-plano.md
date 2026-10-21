# Captação da Produção

Decisão do Paulo (21/10/2026): o fluxo de captação fica dentro do painel e
todos usam. O roteiro de cada peça, a captação marcada, a gravação e a edição
ficam ligados; a conferência do cliente é opcional, como no planejamento.

## Etapa 1 (esta)

- **Para captar**: as peças da Produção em "Agendar Captação" (as que estão em
  Aguardo esperando gravação), por cliente, com o roteiro (o briefing da peça).
- **Montar captação**: escolhe as peças, dia, horário, local e observação. As
  peças viram "Captação Agendada" pelo mesmo caminho do painel
  (`trocarEscolha`, com as automações) e a captação entra no Google Agenda da
  Vybe (`gestaovybe@gmail.com`, conta de serviço com "Fazer alterações").
  Falha do Google vira aviso guardado e "Tentar de novo".
- **Captações marcadas**: dia, horário, local, peças com "Gravado" (vira
  "Captação Feita"); tudo gravado fecha a captação. "Cancelar" tira da agenda
  e devolve as não gravadas para "Agendar Captação".
- Tabelas `vybe_captacoes` e `vybe_captacao_pecas`
  (`migrations/2026-10-21-producao-captacoes.sql`); regras em
  `server/captacoes.js`; tela em `vybe-captacoes.js` (aba Captações da Produção).

## Próximas etapas

2. Biblioteca de roteiros do Drive por cliente e período (documentos "Roteiro…"
   da Vybe), mostrando quais conteúdos saíram de cada documento.
3. Aprovação do roteiro pelo head, peça a peça.
4. Conferência opcional do cliente pelo VybeHub (`area=portal`, como os
   planejamentos).
5. "Roteiro do dia" no celular para o Mizinho, com "Gravado".
6. Edição (Reriston) ligada ao roteiro, à captação e à pasta do Drive.
7. Atalho "Captação de hoje" no Escritório.
