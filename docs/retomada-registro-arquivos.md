# Retomada de arquivos grandes

Arquivos acima de 3 MB usam o envio em trechos existente. Antes do primeiro
trecho, o navegador guarda atividade, nome, tipo, tamanho, data de modificação,
SHA-256 e um contexto criptografado. Não guarda os bytes nem a URL da sessão.
O contexto tem validade de sete dias e é vinculado no servidor à pessoa e à
atividade; a sessão do Drive pode expirar antes disso.

Ao retomar, a API consulta o Drive com `Content-Range: bytes */total`. Só o
`Range` confirmado pelo Drive determina o próximo trecho; ausência de Range
significa zero bytes. Uma resposta de conclusão recupera o ID mesmo quando a
última resposta do envio se perdeu. Não há repetição automática em loop.

A gaveta mostra **Retomar**. Se ainda faltarem bytes, oferece **Selecionar
arquivo original** usando o campo de upload existente. A assinatura confere
que os bytes locais são os mesmos, além dos metadados. Selecionar novamente o
mesmo arquivo também retoma sem abrir outra sessão. O cálculo SHA-256 lê o
arquivo em memória (limite atual: 200 MB).

Após confirmação do Drive, **Concluir registro** resolve falhas do banco ou
respostas perdidas sem reenviar bytes. O servidor bloqueia a atividade na
transação e reutiliza o registro pelo par atividade/ID do Drive; não duplica o
evento nem restaura um arquivo removido. Pendências antigas de registro
continuam válidas. Páginas antigas podem terminar envios já iniciados.

Sessão expirada não reinicia silenciosamente. A interface pede para conferir
a pasta no Drive e permite descartar somente a pendência local, com confirmação,
antes de novo envio. Isso não remove nenhum arquivo do Drive.

## Verificação e limites

Testes isolados cobrem recarga, offset confirmado, última resposta perdida,
arquivo alterado, progresso parado, contexto adulterado, pessoa/atividade
incorretas, expiração, endereço externo, registro idempotente e storage bloqueado.
Não houve upload ou alteração de dados de produção. A interface de Demandas foi conferida em desktop e 390 px na demo local;
a gaveta de Conteúdos também foi inspecionada. Sem erros de JavaScript
registrados no navegador. Os testes de rede e persistência foram isolados.

- Vale neste navegador e conta. Sair da conta ou limpar dados do site remove a
  pendência pelo fluxo de privacidade existente. Não sincroniza entre aparelhos.
- Sem storage disponível, mantém em memória e avisa para não fechar a aba.
- Se a resposta de abertura da sessão se perder antes de receber o contexto,
  nenhum byte foi enviado e não existe contexto local para retomar.
- Até 3 MB, o envio integral pelo servidor não usa esta retomada.
- Não há migração de schema. O endereço da sessão aceita apenas o endpoint
  HTTPS de upload do Google Drive e não segue redirecionamentos.
