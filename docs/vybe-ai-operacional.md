# Vybe AI operacional e estratégica — implementação no PR #357

Decisão de Paulo: escopo operacional da agência inteira; não limitado ao executor. Reutiliza usuários, clientes, responsáveis e módulos do OS. A política vale só para a IA; não altera permissões das telas, administração, Escritório ou jogos.

## Política operacional interna 1

Elegível: sessão de WhatsApp vinculada a pessoa ativa/com acesso + participação atual em pelo menos um dos oito grupos internos aprovados. Emissão do código continua no próprio Perfil; confirmação exige chat privado e declaração de participação. O servidor autoriza a pessoa do código, não um pessoa_id enviado pelo conector.

Audiência: contexto fresco até 30 s, grupos do remetente, identificador e lista completa de participantes (até 100). Somente IDs configurados pelo operador. No privado, audiência é o próprio JID. No grupo, todos precisam de vínculo ativo e conta ativa/com acesso; nenhuma exceção por admin, proprietário, nome do grupo ou título. A conta técnica do bot também precisa ser resolvida se incluída; não se exclui silenciosamente nenhum participante. Grupos de clientes são negados por padrão e não possuem modo ativo.

O conector autenticado é a fonte da fotografia de participantes: essa é uma fronteira de confiança, não uma verificação independente do WhatsApp no Neon. Um processo/token comprometido pode falsificar contexto; controles do Windows e revisão real são bloqueios para ativação. Nenhum campo grupo_aprovado booleano autoriza acesso sozinho.

A variável antiga `VYBE_AI_PESSOAS_LIBERADAS` não participa mais da autorização. Se ainda existir em um ambiente, seu valor é ignorado; esta alteração não remove nem atualiza variáveis da Vercel. A trava global `VYBE_AI_ATIVA` continua desligada por padrão. Todos os funcionários que satisfaçam conta + vínculo + grupo aprovado serão elegíveis quando houver ativação autorizada.

A participação é obtida pelo conector autenticado da biblioteca WhatsApp e revalidada antes/depois da consulta; nunca de IDs escritos na pergunta ou escolhidos pelo modelo. O servidor confere a declaração recente, IDs de grupos configurados e todos os vínculos ativos. Ele não dispõe de uma conexão independente à plataforma WhatsApp: a integridade do conector e de seu token continua sendo uma fronteira de confiança, não uma garantia criptográfica de participação real.

## Ferramentas no endpoint existente

`consulta=autorizar_contexto`: valida elegibilidade/audiência e devolve catálogo estruturado, identidade interna verificada e limites. `consulta=operacional`: repete autorização e executa uma ferramenta enumerada. Nunca SQL, URL ou tabela fornecidos pelo modelo.

- minhas_demandas: responsável é exclusivamente a identidade autenticada fornecida internamente pelo servidor; não há parâmetro de ID. `periodo=hoje` usa o dia de America/Bahia e prazo, ou veiculação se não houver prazo, seguindo a regra do dia da equipe. Não muda contadores do Escritório. O reconhecimento de intenção pessoal no conector tem prioridade sobre linguagem natural e não chama o modelo para escolher pessoa.
- buscar_demandas / detalhar_demanda: ambos os quadros existentes, responsáveis, clientes múltiplos, status, formato, prazo e veiculação, sem duplicar atividade.
- listar_clientes / listar_responsaveis: identificação operacional, sem contatos, permissões, credenciais ou dados de RH.
- listar_planejamentos / detalhar_planejamento: estado de aprovação, resumo e até 20 temas; normalizador existente. Sem links de aprovação, hashes, notas de clientes, observações internas ou documentos.
- listar_captacoes: data/hora/estado da gravação do módulo existente; sem inferir Google Agenda a partir de prazo.
- listar_roteiros: referências operacionais; texto continua no Drive, sem nova cópia.
- consultar_metricas_trafego: ponte para o BI do VybeHub por cliente e período, até 93 dias; exige configuração e alteração de revisão do Hub.
- cobertura_modulos: limites explícitos das fontes disponíveis.

Até 25 resultados por página, deslocamento máximo 2000, filtros de ID/status/data/busca validados. Identificadores são strings na saída; parâmetros numéricos exigem inteiros seguros. Fontes por módulo/ID. Tabelas/colunas sensíveis nunca são selecionadas. URLs, padrões de contato/credenciais em títulos/resumos são omitidos como defesa adicional; isso não substitui classificação humana e não garante detectar todo dado sensível escrito indevidamente num título. Briefings, notas, anexos livres, financeiro, RH, senhas e tokens permanecem fora da política inicial.

Status de publicação é o status registrado, não comprovação de veiculação. Não converter ausência em zero; erros reais são 503. Não há nova migração para ampliar consultas: somente as duas tabelas de vínculo da migração já revisada continuam pendentes de autorização em produção.

## VybeHub — métricas já existentes

Fonte encontrada em `Vybebrasil/vybehub`: `loadBiForClient`, Meta Ads e planilhas por cliente; `portal.bi`/`biCampaigns` existentes exigem sessão de cliente e não devem ser contornados ou reutilizados com cookies administrativos.

Revisão companheira na branch de desenvolvimento `codex/vybe-ai-metricas`: adiciona procedimento de leitura na API tRPC existente (`portal.metricasOperacionais`), reutiliza loader/cadastro e projeta somente métricas aprovadas. Não adiciona leitura Monday. A ponte exige credencial própria de servidor, não reutiliza PORTAL_CHAVE, token do bot, cookies de cliente ou chaves Meta. Nenhuma credencial é gerada ou configurada nesta implementação.

OS: `VYBE_AI_HUB_ATIVO=1`, `VYBE_AI_HUB_URL` de Preview aprovado, `VYBE_AI_HUB_CLIENTES` JSON mapeando IDs OS para slug exato, `VYBE_OS_METRICAS_TOKEN` dedicado. Hub: mesmo segredo dedicado e `VYBE_AI_METRICAS_ATIVA=1`. Ambos desligados/ausentes por padrão. Além do mapa, Hub confere nome exato e cliente ativo; divergência nega, não faz busca aproximada. O modelo nunca recebe slug/segredo nem escolhe endpoint.

Resposta: campanhas diárias, origem (Meta/planilha), período, atualização e truncamento. Sem faturamento, contatos, IDs de conta de anúncio, documentos ou credenciais. Investimento de mídia é métrica operacional autorizada; não é permissão para financeiro da agência. Alcance não se soma como pessoas únicas; resultados separam tipo. Falha da fonte ou fallback com erro é indisponibilidade explícita. A ponte ainda precisa de configuração e validação HTTP entre Previews; não afirmar consulta real a métricas sem esse teste.

## Estratégia e limites

Conector em `conectores/whatsapp`, mantendo !vybe, oito grupos e Qwen/Ollama. Até três ferramentas, contexto de resultados 16 KB, resposta 3500 caracteres mais fontes, sem histórico cruzado. Revalida no início, em cada ferramenta e no fechamento. Audiência alterada descarta resultado. Orientação estratégica: evidência, hipótese, recomendação e próximos passos mensuráveis para branding, posicionamento, copy, storytelling, criatividade, campanhas e mídia. Conteúdo de ferramentas não pode alterar autorização nem executar ferramentas arbitrárias. Falhas/limites interrompem, sem inventar resultado.

Envio segue ausente e SIMULACAO=true obrigatório. Não há ativação de IA, merge, migração ou modificação de Production nesta etapa. Para testar dados reais, ainda são necessárias recuperação de banco comprovada, credenciais/configuração aprovadas, auditoria Windows e piloto autorizado. A preparação das consultas não constitui validação da qualidade estratégica do modelo real.

## Autorização automática — verificação desta alteração

As novas consultas pessoais são ferramentas internas de leitura com parâmetros fechados (período/paginação). Chaves extras, SQL, IDs sugeridos, timestamps de teste e responsáveis são recusados, mesmo em consultas de grupo. O parâmetro interno de identidade de executarFerramenta é montado pelo handler depois da autorização, nunca deserializado do pedido.

Emissão do código pelo Perfil verifica conta ativa/com acesso/senha no banco; confirmação no WhatsApp mantém dez minutos, uso único, três emissões/hora, origem do JID na plataforma e participação aprovada. Não é necessário cadastrar cada funcionário em configuração. Conta ativa sem vínculo não consulta; vínculo revogado ou conta bloqueada é recusado na próxima chamada. Consultas operacionais da equipe permanecem amplas somente nos campos permitidos da política.

Sem migração, credencial, alteração de Vercel ou main. Envios WhatsApp seguem ausentes e SIMULACAO=true obrigatório. Os testes usam PostgreSQL em memória, mensagens e chamadas de modelo simuladas, sem tocar no Neon ou Windows real.

Verificação focada desta revisão: 72 testes aprovados em memória (servidor, interface e conector); sintaxe global e build aprovados. Resultado da suíte geral do commit fica registrado no PR #357.
