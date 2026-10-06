# Evidências de homologação — 9 de setembro de 2026

Código validado: `92be304`, PR #1. A produção permanece em `309c5b4`.

## Ambiente

- Vercel: override `DATABASE_URL` somente na branch `codex/confiabilidade-painel`.
- Neon: branch `codex-homologacao-painel`, ID `br-hidden-breeze-acqbyw0g`,
  criada como cópia de `main`, sem alterar registros da origem.
- Expiração automática do banco: 9 de setembro de 2026, 16h43, America/Bahia.
- `VYBE_HOMOLOGACAO=1` somente nessa branch: bloqueia chamadas de Monday e Drive.
- Operador temporário exclusivo da cópia do banco, desativado ao terminar os testes.

O preview anterior usava a conexão compartilhada de produção. Somente o novo
preview com os overrides recebeu testes de escrita. Após a expiração, o preview
deixará de conectar ao banco; para repetir a homologação, criar nova cópia e
atualizar o override. Não apontar o preview para produção para restaurar os testes.

## Resultados observados

- 24 testes automatizados aprovados; sintaxe e build aprovados.
- Checks do GitHub e deployment de preview aprovados para `92be304`.
- Login HTTP 200 com operador temporário e leitura autenticada de conteúdos HTTP 200.
- Chamada ao Monday bloqueada com mensagem explícita de homologação.
- Alteração de título pela API confirmada em nova leitura; título original restaurado.
- Consulta administrativa da fila HTTP 200.
- Remoção do papel administrativo no banco refletida pelo mesmo cookie na próxima
  consulta de sessão; endpoint administrativo passou a retornar HTTP 401.
- Bloqueio do operador no banco invalidou o cookie existente: sessão HTTP 401.
- Preview anterior: indicadores e webhook sem credencial HTTP 401; código do
  backend HTTP 404; login exibido sem erros no console.

## Pendências de promoção

Confirmar a situação e a autenticação dos webhooks do Monday usados pelo painel.
O segredo existe em Production, mas a configuração dos emissores ainda não foi
verificada. Não foram testados envios reais ao Monday ou ao Drive.

O Nexus é outro projeto e está fora do escopo, conforme orientação do responsável.
Esta revisão não altera o Nexus nem exige trabalho nele para homologar o painel.

Testes completos das seis estações, dispositivos móveis, anexos, comentários e
fluxos de recuperação com as integrações reais ainda não estão comprovados por
este relatório. As operações transacionais e os casos de falha da fila foram
verificados na suíte PostgreSQL em memória.

## Nova orientação: Monday encerrado

O responsável determinou que o painel não dependa mais do Monday. A exigência
de conferir webhooks acima deixa de se aplicar: eles serão encerrados com HTTP
410. Nexus continua fora do escopo. Na cópia isolada foram contados 3.032 arquivos:
3.031 com URL do Drive e um (`VET.png`, id 2) já marcado como ausente desde
29/08/2026. Nenhum arquivo disponível foi removido durante este corte.

Validação da operação independente no preview `fa6ddb8`:

- 27 testes locais, CI e deployment aprovados.
- Os quatro endpoints legados retornaram HTTP 410.
- Criação de conteúdo com ID `vybe:`, criação de subitem em Demandas com ID
  `vybe-subitem:`, alteração, releitura e histórico local aprovados.
- Reprocessamento da fila retornou HTTP 410.
- Fila histórica manteve 1.099 registros antes e depois das gravações.
- Interface Gestor renderizada com dados da cópia do banco; Performance aberta
  sem erros registrados no console.
- Operador temporário novamente desativado e conteúdos de teste arquivados.

## Revisão de arquivos — 01/10/2026

Evidências e limites em [revisao-arquivos-2026-10.md](docs/revisao-arquivos-2026-10.md).
Persistência e rollback verificados em PGlite; interface local em desktop e
celular. Não foram apagados ou enviados arquivos reais. Sem migração de schema
ou mudança de configuração. Recuperação do banco não foi revalidada nesta revisão.
Versão anterior: `48c4afa00e22bc228f96f81ab2b46dad4fc0f4e7`, deployment
`H3iFkCU7GLQTN4JwXvyArPWxJgc6`.

## Retomada do registro de arquivos — 01/10/2026

Ver [retomada-registro-arquivos.md](docs/retomada-registro-arquivos.md).
234 testes, build e interface local aprovados na implementação. A recuperação
usa metadados no navegador e registro idempotente no PostgreSQL; sem migração,
sem alteração de credenciais e sem escrita de teste em produção. A recuperação
do banco não foi revalidada nesta entrega. Variáveis de produção foram conferidas
na publicação anterior desta sessão e permanecem inalteradas.
Versão anterior: `aa63149b944cf2d60fa7d708489b82a0510d54d1`, deployment
`3FW8w9kE9uhRs9487nSB4nSKCrf1`.

## Retomada de trechos de upload — 01/10/2026

241 testes e build aprovados; diff sem erros. Interface de Demandas conferida
em desktop e 390 px e gaveta de Conteúdos na demo, sem uploads reais.
Detalhes em [retomada-registro-arquivos.md](docs/retomada-registro-arquivos.md).
Sem migração ou mudança de variáveis. Recuperação do banco não foi revalidada.
Versão anterior: `8fc378f3f96f81ba690dcec05fc3090c4ed9f24d`, deployment
`9Zr87GJLkruZWaf9uTFBA161dDsH`. CI deve confirmar o commit exato antes da integração.

## Clareza do contexto de status — 02/10/2026

Modal organizado em Contexto e Próxima etapa, com cabeçalho/rodapé separados da
área rolável e seleção múltipla preservada. Checagem local: suíte de 241 testes
aprovada e regressão adicional do seletor aprovada; build final e diff verificados.
Demo conferida em 1280 px e 390 px, aprovação de cliente e alteração com prévia,
sem overflow horizontal, sobreposição do rodapé ou erros de JavaScript.
Escape fecha e devolve a rolagem à página. Nenhuma escrita de teste em produção.
Sem migração ou mudança de variáveis; recuperação do banco não revalidada.
Versão anterior: `f9b3cb56b2652d4235f1a2e2295ea54b2d8c1960`, deployment
`5fP9ju1S9A3T3VgeSpzDjv4LGrXj`. CI e preview devem validar o commit antes da integração.

## Contexto de status por etapas — 02/10/2026

Fluxo guiado no modal existente: respostas preservadas ao voltar, validação por
etapa e revisão antes da confirmação. Suíte local de 242 testes aprovada, mais
duas regressões novas aprovadas separadamente (validação e confirmação somente
na revisão). Build e diff aprovados. Demo desktop e 390 px conferida: campo vazio
bloqueia avanço, retorno preserva resposta e revisão reúne os campos. Sem erros
JavaScript observados e sem gravações em produção. Sem migração ou mudança de
variáveis; recuperação do banco não revalidada.
Versão anterior: `33ce4fd523670350e96af1bea91298180ddccee2`, deployment
`8BvRtTDTCRQb3WzCfyZ5dDeqqHwK`. CI e preview devem validar o commit antes da integração.

## 2026-10-03 — Novas opções durante o cadastro (local)

- Cadastro guiado reutiliza os endpoints de clientes, etiquetas e grupos. Administradores podem adicionar cliente, formato/tipo de demanda, grupo, status e captação/prioridade no próprio formulário. A resposta confirmada seleciona a opção; erros mantêm o texto e o rascunho.
- Clientes ativos sem atividades entram na seleção, preservando a normalização de nomes. Formatos, status, captação e prioridade passam a ler os catálogos ativos. A sugestão automática de status respeita o quadro escolhido.
- API de etiquetas aceita as colunas já existentes de tipo e prioridade de Demandas; mantém autorização de administrador e proteção contra exclusão de opções em uso. Nenhuma migração ou escrita de teste em produção.
- `npm run check`: sintaxe, 250 testes e build aprovados. Regressões cobrem seleção após salvar, conservação do rascunho, erro, permissão, envio repetido, separação de quadros e status sugerido. PGlite verifica gravação, duplicidade e uso das novas colunas na API de etiquetas.
- Navegador na demo local: cliente/formato, tipo de demanda, destino em ambos os quadros, editor de prioridade/captação, Enter e Escape, erro explícito de escrita bloqueada; screenshots desktop e celular inspecionados, sem erros JavaScript no fluxo. A demo não confirma persistência, verificada separadamente nos testes isolados.
- Ainda não publicado. Não foram repetidos testes operacionais de produção.

## 2026-10-03 — Origem por avatar no contexto de status

- Modal existente com cabeçalho compacto, progresso segmentado, foco discreto e seleção da origem por avatar da equipe. Contatos externos usam “Outra pessoa”; o nome continua no campo original da API, sem alterar os responsáveis.
- `npm run check`: 252 testes e build aprovados. Duas regressões verificam seleção da origem, contato externo preservado, IDs inválidos e validação do campo visível. Build repetido após correção cosmética do ícone de fechar; `git diff --check` aprovado.
- Demo local: screenshots desktop e 390 px inspecionados; contato preservado ao voltar, sem overflow horizontal e sem erros JavaScript observados. A demo usa iniciais no lugar de fotos ausentes e não confirma escrita. Nenhuma alteração de banco, variáveis ou teste de escrita em produção.
- Base anterior: commit `7837ac9570509505243c2acac7ec8db731fee471`, deployment `5hNLFH97eeRuCp3KK6HiFZqmV4mj`. Recuperação do banco não revalidada; nenhuma migração nesta entrega. CI e preview devem aprovar o commit antes da integração.

## 2026-10-05 — Material histórico na fila do editor (local)

- Lista de atividades e detalhe usam o mesmo resolver de material bruto. Links históricos são recuperados em leitura, inclusive notas anteriores às 12 mais recentes; campo explícito prevalece e remoção registrada impede ressuscitar links. Entrega final não é material bruto. Nenhuma migração ou alteração de dados em produção.
- `npm run check`: 254 testes e build aprovados; `git diff --check` aprovado. PGlite verifica a leitura real da lista e remoção explícita; regressões cobrem prioridade do campo, histórico HTML, exclusão de entrega e recados longos.
- Navegador local com link fictício: componentes existentes mostram “Bruto” e a mesma pasta no detalhe, sem erros JavaScript observados; screenshots desktop e celular. Demonstração não confirma dados ou escrita de produção. Ainda não publicado.
- Publicação solicitada: base `4e1c4c7d0a08847cb9a66fadecdbf99824847116`, deployment anterior `BjFYMKwhbn6PaVL74CoKk4WhKyVg`. Sem mudança de ambiente; recuperação do banco não revalidada nesta correção de leitura. CI e preview devem aprovar o commit antes da integração.

## 2026-10-05 — Indicador de briefing coerente (local)

- Lista e detalhe usam resolver único para briefing do campo ou histórico, incluindo notas antigas. Campo explícito prevalece; remoção registrada não recupera o texto antigo. Lista transmite somente indicador booleano, sem aumentar o payload com o texto completo.
- Fila e próxima atividade reutilizam botão que distingue presente, ausente e informação ainda desconhecida. Salvar/apagar atualiza as fontes da tela após confirmação; erros de escrita preservam o indicador e falha de atualização posterior não é apresentada como falha de gravação.
- `npm run check`: 258 testes e build aprovados, incluindo leitura completa/incremental com PGlite, resgate histórico, remoção, estados do indicador e erro da API. `git diff --check` aprovado.
- Componentes existentes inspecionados no navegador com dados fictícios: “Sem briefing” coincide com o detalhe; o formulário existente foi aberto sem salvar. Screenshots desktop e celular. Não houve teste de escrita em produção; ainda não publicado.
- Publicação solicitada: base `41d0b077a2fe4007e6a81c9065f8fe5bf394668b`, deployment anterior `7TY5g3sYkogFyezPwum16sPmXczr`. Sem migração ou mudança de ambiente; recuperação do banco não revalidada. CI e preview devem validar o commit exato antes da integração.

## 2026-10-06 — Insumos para produção na fila (local)

- Próxima atividade e fila indicam “Pronto para produzir”, “Falta briefing”, “Falta material bruto” ou “Verificar informações”. Ausência confirmada e dados desconhecidos ficam distintos; formatos sem necessidade de bruto não recebem essa exigência. Indicadores informativos não alteram status.
- Atalhos reutilizam os formulários existentes. Botão de bruto compartilhado entre fila e próxima atividade; dados desconhecidos abrem o detalhe para consulta. Nenhuma alteração de endpoint, schema ou gravação em produção.
- `npm run check`: 261 testes e build aprovados. Regressões cobrem formatos, informações incompletas, atalhos e etapas em que o indicador se aplica. `git diff --check` aprovado.
- Demo local: estados ausente, desconhecido e pronto conferidos; formulários de briefing e bruto abertos sem salvar. Screenshots desktop e celular de 390 px inspecionados, sem overflow horizontal ou erros JavaScript observados. Esta verificação visual não testa persistência. Ainda não publicado.
- Publicação solicitada: base `3b98daf747b1b787613e8bb32ff4445d375fefd2`, deployment anterior `E4gHCRhMPqzML6hbFyVbdKC6GQqZ`. Sem mudança de ambiente ou banco; recuperação do banco não revalidada nesta melhoria de interface. CI executará instalação limpa e os checks do commit exato antes da integração.

## 2026-10-06 — Cap. Agendada e Aguardo sem formulário obrigatório (local)

- Os dois status seguem diretamente para a gravação existente, dispensando o portão de contexto. As exigências dos demais status e as automações permanecem no fluxo existente.
- `npm run check`: 262 testes e build aprovados; `git diff --check` aprovado. Regressão chama a troca de status e verifica gravação direta nos dois casos, mantendo formulário em Falta Info.
- Navegador na demo local: ambos encaminhados diretamente sem abrir formulário, com gravação interceptada em memória; sem erros JavaScript observados. Não valida persistência e não escreve em produção. Ainda não publicado.
- Publicação solicitada: base `558f02110a5f8a51c19ff1a8191734db66d75887`, deployment anterior `7NBcid18wMzGfpp7qkwABAVnorKk`. Sem migração ou mudança de ambiente; recuperação do banco não revalidada. CI fará instalação limpa e checks do commit exato antes da integração.
