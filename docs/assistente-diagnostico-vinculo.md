# Comparação administrativa do vínculo em Preview

Preparada localmente; não publicada. Complementa o pacote mínimo existente;
não substitui as alterações anteriores de autorização exclusiva.

POST `/api/painel?area=assistente&consulta=diagnostico_vinculo`, JSON contendo
exclusivamente `jid`, enviado no corpo, nunca na URL. Utilizar a sessão pessoal
administrativa já autenticada e a origem do alias da branch Preview.
Não colocar identificadores no console, histórico de comandos ou logs.

O servidor revalida a sessão pelo mecanismo existente e exige a conta fictícia
`Paulo Teste AI — fictício`, e-mail de fixture, acesso ativo, senha e administração.
Exige Preview, flag de homologação e branch específica; confere o fingerprint
do banco isolado aprovado antes de consultar o vínculo. Não usa as duas variáveis
administrativas ainda ausentes para evitar dependência circular.

O HMAC é calculado pela função existente com `VYBE_AI_LINK_SECRET` do servidor.
O SELECT exige a mesma conta autenticada e vínculo não revogado. A transação é
READ ONLY; nenhuma emissão, revogação ou atualização é realizada.
Sucesso retorna somente `{resultado:"CORRESPONDE"}` ou
`{resultado:"NÃO CORRESPONDE"}`, sem identificadores ou hash. Falhas de sessão,
configuração, banco ou execução usam erros HTTP genéricos; não são tratadas
como prova de divergência. Resposta sem cache e sem logs da aplicação.

O diagnóstico prova a correspondência do JID fornecido, não sua origem.
A coleta anterior não conservou o JID para reutilização. Antes da execução
remota, definir o transporte protegido desse identificador já confirmado;
não recuperar bases Chromium, inferir telefone nem reiniciar o bot sem autorização.
Verificar também políticas externas de registro de corpos de requisição.

Para publicar, revisar o diff preservando as mudanças anteriores e incluir
`api/painel.js` e `server/assistente-diagnostico-banco.js`; acrescentar o teste
`tests/assistente-diagnostico-vinculo.test.mjs` ao pacote de revisão.
Não há dependências, migrações ou variáveis novas. Publicação somente com
autorização explícita, exclusivamente no destino Preview aprovado.
