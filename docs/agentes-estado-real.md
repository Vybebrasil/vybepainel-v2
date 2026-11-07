# Estado real dos agentes no mundo

A planta continua descrevendo funções e ferramentas. Ela não determina o estado operacional dos agentes. O mundo consulta os registros já existentes na central; nenhum agente ou automação é iniciado por esta entrega.

## Caminho dos dados

`GET /api/painel?area=vybes&etapa=agentes` exige sessão, usa `entradaVybes` para obter o crachá no servidor e consulta `/api/cosmos/agentes` no túnel permitido. O token é enviado como cookie apenas entre os servidores e não aparece no retorno. Destino externo, credenciais na URL, redirecionamento, corpo maior que 256 KiB e contrato inválido são recusados, com erros sem detalhe remoto. `scripts/dev-server.mjs` usa o mesmo leitor na porta 4451, como já fazia para o cérebro, preservando a sessão e o modo de inspeção.

`mundo/atividade-agentes.mjs` valida os setores, estados, horários e até 20 registros por setor; projeta apenas os campos necessários. Estados atuais: disponível, executando, aguardando aprovação, falhou. Disponível sem execução registrada recebe esse selo; disponível cujo último registro falhou mostra Falhou. Setor ausente da resposta fica sem leitura, sem fingir disponibilidade. Uma referência abre peça somente no formato explícito `vybe:ID`; hashes opacos da central não são tratados como IDs de peça.

## Interface

O painel do agente tem selo, conexão/horário da consulta, tarefa e desde quando, e últimos registros com ferramenta, resultado/erro e horário em America/Bahia. As consultas e ferramentas existentes do painel, inclusive CRM, permanecem abaixo em Operação do painel. Elas não são usadas como prova de trabalho executado pelo agente.

Monitores e figuras começam neutros. Executando anima monitor/figura; falha fica vermelha; aprovação pendente tem a própria cor. O Cérebro conta estados observados e anima a sinapse do agente somente quando está executando com leitura disponível. Atualizar essa camada não refaz o voo da câmera; objetos clicáveis antigos são removidos ao reconstruir os nós.

A consulta tem intervalo mínimo de 15 segundos, sem requisições simultâneas, e usa o temporizador já existente do mundo. Não consulta no lobby sem sessão ou com a aba oculta. Em falha, mantém os dados em memória e avisa `Central fora do ar — última atualização às HH:MM`. Sem leitura anterior, informa isso, sem inventar horário. As animações dos agentes ficam congeladas durante indisponibilidade. Os dados não são persistidos em localStorage; limpar a sessão invalida respostas em andamento.

## Validação

`tests/vybes-agentes.test.mjs`: ponte, cookie só no servidor, campos extras removidos, destino externo recusado, erros sem segredo, limite de tamanho, dados inválidos, 401 sem sessão, método de escrita negado, estados e referência de peça, atualização limitada, recuperação de conexão, logout durante consulta, apresentação de última leitura e monitores Three.js.

Conferência em `http://localhost:4451`, launch vybe-os-mundo-real, sessão existente: mundo abriu, painel do Redator recebeu a leitura real da central, camada Agentes contou 15 setores sem execução registrada e console sem erros. Não foram geradas tarefas, propostas ou confirmações reais só para animar o prédio. Estados executando/falhou e indisponibilidade são verificados pelos testes isolados.

Entrega em PR separado, sem merge e sem deploy. Sem migração ou alterações no bot/central nesta etapa.
