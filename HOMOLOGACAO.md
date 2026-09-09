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
