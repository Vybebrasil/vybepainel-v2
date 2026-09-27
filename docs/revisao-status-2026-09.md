# Confirmação de status — 27/09/2026

Escopo: troca de status, confirmação após escrita, resposta das automações e
releitura da janela de detalhes. Grupos e responsáveis foram inspecionados para
mapear o fluxo; não receberam uma nova auditoria completa nesta entrega.

## Correções

- Status e histórico são gravados na mesma transação. Falha no evento reverte a
  mudança de status, sem perder os vínculos de clientes ou responsáveis.
- A resposta de automação inclui o status final, cor, borda e índice do quadro.
  A interface usa esse estado, em vez de reaplicar o status intermediário escolhido.
- Falha na releitura depois de uma gravação confirmada informa “Status salvo” e
  orienta a atualizar os detalhes, sem apresentar a operação como recusada.
- A releitura só redesenha a mesma janela e atividade. Comentários e links ainda
  não enviados são preservados, inclusive se digitados enquanto a leitura ocorre.
- Envios simultâneos para a mesma atividade são bloqueados nesta página. O caminho
  de confirmação usa somente a escrita nativa, sem fallback ao Monday.

## Evidências

- `npm run check`: 181 testes, sintaxe, escopo global e build aprovados.
- Seis regressões em `tests/status-confirmacao.test.mjs`: erro de releitura,
  recusa de escrita, rascunhos e status final, troca de janela/concorrência,
  rollback transacional e automação real em PGlite.
- O teste de banco chama `trocarStatus` e o motor de automações, relê o status final
  e confirma a preservação de dois clientes e um responsável. Uma restrição no
  histórico reproduz a falha e comprova a reversão.
- Chrome local em 1440×1000 e 390×844: atividade fictícia aberta pela interface,
  rascunho preenchido e função de confirmação exercitada diretamente (a demo só
  oferece uma etiqueta). Uma requisição nativa recusada pela demo, status e texto
  preservados, sem erro JavaScript. Screenshots inspecionados.
- `git diff --check` aprovado.

## Limites

Não foram feitas escritas em produção, migrações ou alterações de credenciais.
A demo não comprova persistência; essa parte foi verificada no PGlite. A trava
não serializa usuários/abas diferentes. O motor continua executando automações
após confirmar o status, segundo a política existente; a atomicidade da sequência
inteira de ações de uma automação não foi alterada nesta entrega.
