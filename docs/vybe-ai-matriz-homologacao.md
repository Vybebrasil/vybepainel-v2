# Matriz de consolidação da Vybe AI — 25/10/2026

Somente bancos isolados, credenciais atuais, SIMULACAO=true e prévia no CMD.
Nenhum envio, escrita, migração, troca de vínculo ou alteração de permissões.
Esta matriz prepara testes; não afirma que os cenários pendentes passaram.

## Evidência já obtida

O operador confirmou ponta a ponta WhatsApp vinculado → OS Preview → Hub Preview
→ Qwen local → PREVIA_WHATSAPP_SIMULACAO, com simulacao_concluida:
cliente fictício OS 900000201 / Hub 1, slug cliente-ficticio-ai, em 24/10/2026,
módulo trafego, investimento 25, impressões 1000, alcance 800, cliques 20,
resultados 3 e resultType messages. A marca DADOS FICTÍCIOS DE HOMOLOGAÇÃO apareceu.
A data 1792800000000 corresponde a 24/10/2026 no dia UTC usado pelo BI.

A correção de apresentação converte somente o campo date em DD/MM/AAAA. Não
altera o payload, filtros, cálculos, dateLabel ou valores. Dias de BI não usam o
fuso do computador, para não transformar meia-noite UTC no dia anterior.
O cenário ponta a ponta com esta nova formatação ainda deve ser repetido após
carregar o arquivo atualizado no processo local.

## Ferramentas do OS existentes

Para registros sem fixture confirmada, primeiro conferir disponibilidade por
leitura na homologação. Usar somente IDs fictícios retornados e não assumir IDs
de planejamento, captação ou roteiro. Se não existir fixture, registrar esse
pré-requisito; não criar registros nesta etapa. Adaptadores fictícios podem ser
usados nos testes automatizados, mas não contam como validação ponta a ponta.

| Ferramenta existente | Recorte/fixture para o teste | Resultado a conferir | Ponta a ponta |
|---|---|---|---|
| minhas_demandas | Conta fictícia vinculada; periodo hoje/todas e situacao todas/pendentes/atrasadas | Identidade do servidor; status final e prazo oficiais; sem prazo não é atraso; vazio de hoje com frase própria | Pendente desta matriz |
| buscar_demandas | Cliente 900000201; recorte paginado e demanda fictícia conhecida | Título, status, prazo, filtro e paginação coerentes; sem inferir publicação | Pendente |
| detalhar_demanda | ID fictício obtido na busca; secoes ficha/comentarios/historico/tarefas/arquivos | Briefing e referências autorizadas; nenhuma leitura binária de anexos; seção e paginação respeitadas | Pendente |
| listar_clientes | Busca por Cliente Ficticio AI; limite e deslocamento | Cliente autorizado correspondente, sem contatos/contratos | Pendente |
| listar_responsaveis | Somente contas fictícias ativas | Nomes/funções autorizados; sem e-mail, senha ou sessão | Pendente |
| listar_planejamentos | Cliente fictício e período | Mês e situação reais da fixture; vazio distinto de fonte indisponível | Pendente; conferir fixture |
| detalhar_planejamento | ID fictício retornado pela listagem | Peças, textos, ajustes e decisões válidas; sem link secreto | Pendente; conferir fixture |
| listar_captacoes | Cliente fictício e datas | Registros locais de gravação; nenhuma chamada ao Google | Pendente; conferir fixture |
| listar_roteiros | Cliente fictício | Somente referências operacionais; não prometer texto do Drive | Pendente; conferir fixture |
| consultar_perfil_trabalho | Pessoa fictícia confirmada; período máximo de 180 dias | Mesmos cálculos do domínio; cobertura e ausência de dados preservadas | Pendente; conferir fixture |
| consultar_perfil_jogo | Pessoa fictícia; secao resumo/inventario/conquistas | Nível, XP, moedas e itens públicos, sem escrita | Pendente; conferir fixture |
| consultar_ranking | periodo dia/semana/mes/total | Ordem, empates, paginação e dados do domínio; sem pagar prêmios | Pendente; conferir fixture |
| consultar_dia_equipe | Somente equipe fictícia | Previsto, pronto, adiado e atrasado oficiais; hoje é dinâmico | Pendente; conferir fixture |
| consultar_metricas_trafego | Cliente e período da fixture; modulo explícito | Correspondência exata, origem e identificação de homologação | Somente trafego comprovado; demais abaixo |
| cobertura_modulos | Sem argumentos | Catálogo e limitações existentes, sem alegar fonte disponível sem dados | Pendente |

## Submódulos reais da ponte Hub

Todos são opções do parâmetro modulo de consultar_metricas_trafego; não são
novas ferramentas. Período máximo 93 dias; limite até 25; deslocamento até 2000.

| Módulo | Fonte permitida na homologação atual | Próximo teste / expectativa | Ponta a ponta |
|---|---|---|---|
| trafego | metrics da fixture sintética | Repetir 24/10/2026: data 24/10/2026, valores acima e marca fictícia; período sem registros retorna vazio identificado | Valores comprovados; nova data pendente |
| faturamento | metrics da mesma fixture sintética | Conferir se há campo faturamento na fixture antes do teste; ausente não vira zero | Pendente |
| objetivos | client:objective do cliente fictício | Conferir disponibilidade e exibir objetivos atuais, sem inventar histórico por período | Pendente |
| aprovacoes | Aprovações locais do cliente fictício, filtradas por updatedAt | Conferir fixture existente e período; não alterar aprovação | Pendente |
| alcance | Sem adaptador fixture permitido neste modo | Indisponibilidade explícita; nenhum fallback externo ou resultado fabricado | Pendente (negativo) |
| interacoes | Sem adaptador fixture permitido neste modo | Indisponibilidade explícita, sem Google/Meta | Pendente (negativo) |
| seguidores | Sem adaptador fixture permitido neste modo | Indisponibilidade explícita, sem estimar crescimento | Pendente (negativo) |
| campanhas | Bloqueado: seed atual não possui datas de campanhas | Indisponibilidade; não inventar suporte ao filtro de período | Pendente (negativo) |
| anuncios | Sem adaptador fixture permitido neste modo | Indisponibilidade, sem criar cliente Meta | Pendente (negativo) |
| publico | Sem adaptador fixture permitido neste modo | Indisponibilidade, sem públicos externos | Pendente (negativo) |
| segmentacao | Sem adaptador fixture permitido neste modo | Indisponibilidade, sem consulta externa | Pendente (negativo) |
| documentos | Drive bloqueado; sem adaptador fixture permitido | Indisponibilidade, sem acessar arquivos reais | Pendente (negativo) |
| marca | Drive bloqueado; sem adaptador fixture permitido | Indisponibilidade, sem inferir documento/conteúdo | Pendente (negativo) |

## Controles transversais

- Manter verificação de identidade, vínculo, participação atual em grupo e
  audiência antes da chamada e antes da exibição. Testar revogação, conta inativa
  e mudança de audiência em mocks; não revogar nem alterar contas para testar.
- Sem token, token inválido, flag desligada ou bypass/origem inválidos devem
  negar; fingerprint ausente/divergente deve bloquear antes do driver. Usar
  testes existentes e fixtures, sem revelar ou substituir segredos.
- Cliente divergente/inativo, argumentos extras, SQL/URL em argumentos,
  prazo/limites excedidos e instruções maliciosas não ampliam acesso.
- Não copiar observações livres para fingir marca fictícia. O rótulo fixo só
  aparece quando origem_dados é homologacao_fixture; inclusive em recorte vazio.
- Conferir que datas e métricas originais não são modificadas pela apresentação.
- Nunca confundir aprovação em teste automatizado com ponta a ponta de módulo.

## Ordem recomendada

Repetir tráfego com data legível; validar listagens e demandas; detalhar somente
IDs fictícios encontrados; depois planejar perfis/jogo/ranking e as fontes Hub
disponíveis. Executar os negativos de fontes bloqueadas antes de ampliar fixtures.
Nenhuma ampliação de funcionalidades ou dados faz parte desta consolidação.
