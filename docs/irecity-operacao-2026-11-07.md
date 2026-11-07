# Irecity — semana, pendências, abertura e salas (07/11/2026)

Implementação na branch `codex/semana-atencao-agencia`, sobre a main do PR #506. Commit, push e abertura de PR autorizados pelo Paulo. Sem deploy, migração ou reinício de serviços nesta etapa. Preservadas fora do commit as alterações anteriores em `vybe-escritorio-mapa.js` e `arquivo/`.

## Entrega

- Gráfico da agência: seleção de prazo ou veiculação; semana anterior, próxima e atual; período explícito. O mesmo controle existe na visão do dono e no gráfico da Gestão. Sem fallback de uma data para outra: uma peça sem veiculação não aparece como prevista por veiculação. Entregues continuam na data real da troca para status de entrega, como antes, e a legenda informa isso. O recorte do gráfico não desloca o hoje real nem os alertas/cobertura do painel.
- Clientes em atenção: o clique da lista abre a placa existente com as pendências e os motivos, responsável, status, prazo e veiculação separados. Cada demanda abre a ficha existente. Falta de planejamento/cobertura sem uma demanda vinculada é informada como tal. Demandas compartilhadas aparecem para cada cliente envolvido, sem duplicar a contagem geral.
- Gargalos: cartões clicáveis abrem todas as demandas do recorte contabilizado, não apenas oito. As cores vêm de `status_color` pelo mesmo helper do calendário, com cinza neutro se a cor estiver ausente.
- Abertura: a classe do Irecity é aplicada no início do body, antes de liberar as telas antigas. A porta explícita `?legado=1` permanece. Dados do terreno e empresas têm prazo de rede; o motor WebGL só é criado depois dos dados. Falha durante a montagem descarta o motor. O carregador não faz novas tentativas automáticas após falhar: mostra repetir. Uma tentativa explícita pode recarregar um módulo que falhou, sem manter motores antigos. A conclusão da carga sincroniza a pausa com a tela efetivamente aberta. Perda/restauração do contexto WebGL suspende e invalida o desenho no motor existente.
- Salas: Ir até e entrar numa sala usam o movimento original e só enquadram uma sala realmente alcançada. Abrem o andar e focam o cômodo; uma resposta antiga não rouba o foco após trocar de destino. A barra oferece Minha sala pelo vínculo `pessoa_id`/`base.eu`; não infere propriedade por nome. Entrar na chamada e clicar em alguém da própria sala também enquadram o cômodo. Mute e permissões anteriores foram preservados.

## Verificação

- Primeira seleção: 49 testes SAFE passaram.
- Suíte completa antes do último ajuste do clique de pessoa: 1.235 testes passaram, sintaxe/escopo e build aprovados.
- O ajuste final do clique de pessoa passou nos 33 testes selecionados de operação e chamadas. A verificação completa final (`npm run check`) passou com 1.236 testes, zero falhas/cancelados/ignorados, sintaxe/escopo e build aprovados. `git diff --check` também passou.
- A primeira execução de um teste de descarte falhou porque o dublê não fornecia `Empresas.EMPRESAS`; o dublê foi completado com a lista vazia, sem alterar a regra da aplicação.
- Prévia estática gerada com funções e CSS reais e dados fictícios, mas não inspecionada: o navegador embutido não abriu e o Chrome recusou `file://` por política de URL. Nenhuma restrição foi contornada.

## Limites e validação real pendente

Não foi reproduzido o congelamento no navegador do Paulo com console/GPU reais. As correções cobrem falhas concretas encontradas na ordem de inicialização, rede e descarte; não comprovam ausência de qualquer congelamento de driver ou WebGL. Ainda é necessário testar abertura/recarregamento, tela e celular, rolagem das listas e entrada na sala com duas pessoas em ambiente autorizado. As salas de voz e suas permissões no Worker não foram modificadas.
