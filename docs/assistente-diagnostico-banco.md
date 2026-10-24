# Verificação temporária do banco da Vybe AI

Preparação local em `feature/vybe-ai-readonly-integration`. Sem push, deploy,
migração, consulta remota ou alteração de dados/configuração nesta etapa.

## Reutilização

A busca no projeto não encontrou diagnóstico da identidade do PostgreSQL.
O diagnóstico da agenda é de outro serviço e não identifica o banco.
Esta implementação reutiliza `/api/painel`, a fábrica `sql()` da aplicação
(`bancoComTransacoes(process.env.DATABASE_URL)`) e `sessaoDoPedido`.
Não há endpoint Vercel adicional nem conexão com um banco de referência dentro
do diagnóstico. O bot e a geração de códigos continuam com a conexão existente.

## Restrições do diagnóstico administrativo

Requisição: `GET /api/painel?area=assistente&consulta=diagnostico_banco`.

- Exige simultaneamente `VERCEL_ENV=preview`, `VYBE_HOMOLOGACAO=1` e
  `VERCEL_GIT_COMMIT_REF=feature/vybe-ai-readonly-integration`. São valores
  lidos no servidor; o cliente não pode substituí-los. Nenhuma variável é criada
  ou alterada pela implementação. Fora dessas condições: HTTP 404 antes de
  abrir conexão, inclusive para administradores e OPTIONS.
- Somente GET; demais métodos retornam 405. Parâmetro `canal` é recusado.
- Exige cookie de sessão pessoal válido. Tokens de bot, serviço e manutenção
  não são aceitos como substitutos da sessão.
- A sessão é revalidada com os dados atuais de acesso e versão do banco.
  Conta inativa, sem acesso, sem senha, excluída ou com sessão invalidada recebe
  401. Pessoa sem administração recebe 403, antes da consulta de metadados.
- A busca de autenticação padrão executa DDL de inicialização do schema.
  O callback `buscarPessoa` existente permite reutilizar a validação oficial
  usando apenas SELECT. Aqui não há inicialização de schema: nem ALTER, nem
  CREATE, nem atualizações. A presença da senha é consultada como booleano;
  o diagnóstico não lê o conteúdo do hash, nome, e-mail ou sal.
- Consultas de autenticação e metadados são executadas em transações READ ONLY.
  O driver recebe a mesma fábrica de conexão da aplicação.
- Resposta `Cache-Control: no-store`. Falhas retornam mensagem fixa com HTTP
  503; o objeto do driver e os parâmetros não são impressos ou devolvidos.

## O que é comparado

A consulta de metadados é exclusivamente `SELECT current_database() AS banco`.
A resposta contém apenas `ok`, `banco` e `identificador_banco`.

O identificador é SHA-256 de um domínio fixo/versionado, do endpoint da conexão
DATABASE_URL e do nome retornado pelo PostgreSQL. O sufixo de pooler é
normalizado. Usuário, senha, opções e string de conexão não entram no hash.
Endpoint diferente ou banco diferente produz outra referência. O nome retornado
pelo PostgreSQL precisa coincidir com o banco indicado na URL; inconsistência
retorna 503. O endpoint nunca aparece em claro na resposta.

Não é criado um marcador ou registro no banco. Este identificador é uma
impressão digital do destino da conexão, não uma consulta ao nome amigável
do projeto Neon nem um UUID gravado dentro do banco. Apenas `neondb` não
provaria isolamento: o identificador também precisa coincidir.

## Referência independente da homologação

O recurso `vybe-ai-homologacao`, projeto Neon `blue-pine-55207839`, teve o
endpoint conferido como distinto do de produção e o nome `neondb` confirmado
por SELECT somente leitura na etapa anterior desta conversa. A aplicação
não calcula esta referência usando sua própria DATABASE_URL como se fosse
evidência independente. A referência abaixo foi calculada localmente, sem
conexão de rede, a partir daquele endpoint já identificado e do nome confirmado.

Resultado esperado para comparação, ainda não observado na Preview:

```json
{
  "ok": true,
  "banco": "neondb",
  "identificador_banco": "sha256:f15a33699c956ed4263414a0fd8be51bdeb3791dbde745afa8c82e4929c2d3b0"
}
```

Depois de autorização separada para publicar em Preview, um administrador já
autenticado nesse ambiente poderá abrir a URL acima na mesma origem do painel.
Compare os dois campos exatamente. Divergência, 401/403, 404 ou 503 significa
que a correspondência não foi comprovada; não executar redefinição de senha.
Um resultado coincidente comprova o destino para aquela implantação e momento,
sem provar automaticamente o destino de outra URL fixa utilizada pelo bot.

A conta fictícia Paulo Teste AI foi anteriormente confirmada como não
administrativa. Ela não pode usar este diagnóstico; nenhuma permissão foi
elevada e nenhum cookie privilegiado foi criado. É necessária uma sessão
administrativa legítima já existente no ambiente. Se não houver, o acesso
continua bloqueado e será necessária outra solução explicitamente autorizada.

## Alternativa autorizada: token existente do bot

Foi preparado localmente um segundo modo, sem alterar as exigências do
diagnóstico administrativo:

`GET /api/painel?area=assistente&canal=bot&consulta=diagnostico_banco_bot`

O operador deve usar o header Authorization com o token existente do bot,
mantido apenas em memória. Não colocar token em URL, parâmetros de terminal,
arquivos temporários, logs ou screenshots. A chamada não é um comando WhatsApp
nem uma ferramenta do modelo; a lista de consultas do conector não foi ampliada.

O servidor exige simultaneamente Preview, a branch exata da integração e
`VYBE_HOMOLOGACAO === '1'`. Qualquer divergência retorna 404 antes de criar a
conexão. Outros métodos recebem 405; canal diferente recebe 403; token ausente,
inválido ou não configurado recebe 401, também antes do banco. Todos os resultados
têm `Cache-Control: no-store`. Cookies administrativos não substituem o token.

A autenticação reutiliza `autenticarAssistente`, incluindo sua comparação em
tempo constante. Nenhuma chave nova ou variável é necessária. Após autenticar,
o modo faz exatamente uma consulta `SELECT current_database() AS banco` em
transação READ ONLY pela mesma fábrica `sql()`/DATABASE_URL da aplicação. Não
há leitura de funcionários, vínculos ou desafios, nem chamada de inicialização
de schema. A resposta de sucesso contém somente:

```json
{
  "banco": "neondb",
  "identificador_banco": "sha256:f15a33699c956ed4263414a0fd8be51bdeb3791dbde745afa8c82e4929c2d3b0"
}
```

Esse é o valor de referência, não uma resposta já observada na Preview. Erros
de consulta/configuração retornam apenas mensagem fixa e 503, sem logs do driver.
O administrador continua usando sua rota original e recebendo o mesmo contrato.
As duas rotas compartilham apenas a leitura dos metadados e a impressão digital.

Depois de uma autorização separada para publicar em Preview: verificar o commit
e URL exatos do deployment, fazer a chamada autenticada sem persistir o token e
comparar ambos os campos com a referência independente acima. Divergência ou
qualquer recusa não comprova a conexão e deve impedir redefinição de senha.
Nenhuma senha ou permissão precisa ser modificada para executar a verificação.

### Consulta segura pelo CMD, depois de publicação autorizada

Não executar agora contra a Preview: a publicação e a consulta real ainda
dependem de autorização. Primeiro confirme que o alias da branch está READY
no commit autorizado, e não apenas que um build foi iniciado.

No Windows com Node 24, o script abaixo lê o token já existente em
`C:\whatsapp-ia\token-vybe.txt` diretamente para a memória. Ele não escreve
credenciais, não inicia o bot e não altera variáveis de ambiente. Não use
`type`, `echo`, token literal ou parâmetro de token no CMD.

Execute no diretório desta cópia local do repositório:

```cmd
node scripts\assistente-consultar-banco-preview.mjs
```

O destino é fixo: somente o alias da branch de homologação, sem opção para
substituí-lo por produção. O token vai exclusivamente no header Authorization.
O script impede redirecionamento, usa timeout de 15 segundos, não faz retries,
limita a resposta a 4 KB e valida estritamente os dois campos de metadados.
Erros HTTP exibem somente o status; erros de arquivo ou rede recebem mensagem
fixa, sem stack, corpo remoto, headers ou detalhes da conexão.

Saída esperada: o JSON com `banco`/`identificador_banco` e uma frase informando
se ambos coincidem com a referência. Código de saída 0 = correspondência;
2 = divergência; 1 = consulta recusada, indisponível ou resposta inválida.
Consultar um endpoint errado, receber 404 por flag ausente, ou falhar no acesso
à Vercel não comprova o banco. Não redefinir senha nesses casos.

Não é necessário copiar, recriar ou exibir o token. Se o arquivo não existir
ou não puder ser lido pelo usuário atual, interromper; não enfraquecer suas
permissões e não passar a credencial por argumento. A sessão do WhatsApp não
é utilizada para esta consulta.

### Limites e riscos residuais

- Quem já possui o token válido do bot terá acesso a esses dois metadados
  naquele Preview. Isso não concede administração nem dispensa as regras das
  consultas operacionais. O modo técnico não depende de ativação operacional,
  vínculo de funcionário ou segredo de vinculação, pois não acessa esses dados.
- A impressão digital não é segredo nem mecanismo de autenticação. Ela
  identifica endpoint e banco, não o nome amigável do projeto Neon. Mudança de
  endpoint exige reconferir a referência independentemente; o pooler e a porta
  PostgreSQL padrão são normalizados.
- A conferência de uma URL não prova o destino de outra URL fixa do bot.
- Ainda falta validar no deployment real: este código não foi publicado e não
  comprova por si só que a flag ou a conexão atuais estejam corretas.
- As rotas são temporárias e devem ser removidas depois de registrar a evidência.

## Testes e remoção

`tests/assistente-diagnostico-banco.test.mjs` cobre nove casos: bloqueios por
ambiente/branch, método/canal, ausência/adulteração de sessão, tokens de serviço,
permissão vigente e revogação, saída mínima, estabilidade e divergência da
impressão digital, erros sem detalhes privados, roteador real em produção e
consulta PostgreSQL em memória sem DDL ou alterações de registros pelo handler.
Os testes usam somente dados sintéticos; não acessam o banco remoto.

Resultado anterior, com apenas o diagnóstico administrativo: 85 testes do
assistente aprovados (76 existentes + nove novos). Na suíte geral anterior,
689 de 693 passaram. Persistem as mesmas quatro falhas anteriores nas
cenas compostas, cidade, filtro do Dia da equipe e fotos da equipe. A verificação
geral não está aprovada; essas áreas não foram alteradas nesta tarefa.

`tests/assistente-diagnostico-bot.test.mjs` acrescenta dez testes de bloqueio de
ambiente/branch, flag exata, autenticação, método/canal, resposta mínima e cache,
tentativa de escolher conexão por parâmetros, divergência, erros sem logs,
roteador e ausência de alterações em PostgreSQL em memória. Os nove testes
administrativos permanecem passando após o compartilhamento da consulta.

Resultado antes do cliente de consulta: 95/95 testes do assistente aprovados, incluindo
19/19 dos diagnósticos (nove administrativos + dez pelo token). Sintaxe, build
e `git diff --check` aprovados. A suíte geral teve 703 testes: 699 aprovados e
as mesmas quatro falhas anteriores. `npm run check` continua reprovado por
essas falhas, sem modificação das áreas afetadas.

O cliente de consulta tem cinco testes adicionais, usando apenas token fictício
e respostas simuladas: envio seguro no header, token/arquivo inválido, erros e
redirecionamentos sem exposição, resposta estrita/limitada e comparação dos dois
campos. A rodada de preparação do commit aprovou os 100 testes do assistente.
Sintaxe, build e verificação do diff aprovados. A suíte geral desta rodada teve
708 testes: 704 aprovados e as mesmas quatro falhas anteriores, fora do escopo.
Assim, `npm run check` permanece reprovado; não é aprovação da suíte completa.

## Plano de remoção depois de registrar a evidência

1. Registrar somente commit, ID/URL do deployment, data, nome do banco e
   impressão digital observados. Não registrar headers nem token.
2. Retirar a importação e os dois blocos de despacho de diagnóstico de
   `api/painel.js`. Remover `server/assistente-diagnostico-banco.js`,
   `tests/assistente-diagnostico-banco.test.mjs`,
   `tests/assistente-diagnostico-bot.test.mjs`, o script
   `scripts/assistente-consultar-banco-preview.mjs` e
   `tests/assistente-consulta-diagnostico.test.mjs`. Atualizar este documento
   com a evidência e o estado removido, sem desfazer outras mudanças da branch.
3. Executar os testes restantes, sintaxe, build e revisão do diff; preparar
   commit de limpeza. Push e nova Preview exigem autorização separada.
4. Após publicação autorizada da limpeza, confirmar que o alias atualizado
   deixou de retornar metadados nas duas consultas.
5. IMPORTANTE: remover o código no alias não remove o endpoint de URLs imutáveis
   de deployments antigos. Relacionar todos os deployments Preview que
   receberam este diagnóstico e, após autorização específica e preservação da
   evidência não sensível, excluí-los na Vercel. Não excluir produção. Se não
   houver autorização/acesso para isso, informar que a remoção está incompleta.

Não haverá dados de banco, variáveis ou permissões para reverter. Nenhuma etapa
de remoção ou publicação foi executada nesta preparação.
