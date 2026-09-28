# Material bruto — 28/09/2026

O registro confirmava sucesso, mas o painel continuava indicando ausência de
material. Três causas no código: findOperationalItem retorna uma cópia normalizada,
o redesenho chamava renderFocusDesk (inexistente) e a resposta de areaPeca omitia
material_bruto apesar de selecioná-lo no banco.

A correção atualiza as fontes reais e o cache, reutiliza renderOutboundItemPatch
e devolve material_bruto/material_bruto_em no detalhe. Reutiliza a atualização da
gaveta com preservação de rascunhos e proteção contra resposta tardia, renomeada
para atualizarGavetaPreservandoRascunhos. Link e histórico passam a ser atômicos.

Verificação: npm run check aprovado, 193 testes; git diff --check aprovado.
PGlite verifica persistência, rollback e remoção. O teste da resposta executa
areaPeca real, lendo o registro persistido e simulando as consultas não relacionadas.
Chrome local, desktop 1440×1000 e celular 390×844: formulário, recusa da demo,
exibição da pasta e preservação de rascunho, sem erros JavaScript. O caso de sucesso
no navegador usa resposta interceptada apenas no processo de teste; não representa
escrita na demo. Screenshots inspecionadas. Nenhuma escrita em produção.

Não foi consultado o registro específico do cliente em produção. Portanto, não
se afirma que aquele link está persistido; a omissão na leitura e o estado local
explicam a inconsistência apresentada. Sem migração de schema ou dependência Monday.
