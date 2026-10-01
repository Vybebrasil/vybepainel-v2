# Retomada do registro de arquivos grandes

Depois da confirmação de conclusão do Drive, o navegador guarda os metadados
necessários para registrar o anexo: atividade, ID do arquivo, nome, tipo, tamanho
e data de modificação do arquivo local. Não guarda bytes, tokens ou URL da sessão
de upload. A pendência é separada pela pessoa logada.

Se o registro falhar ou sua resposta se perder, a gaveta oferece **Concluir
registro**. Recarregar a página preserva a pendência; selecionar novamente o
mesmo arquivo tenta apenas o registro. A API existente continua autenticada.
O servidor bloqueia a atividade durante a transação, reutiliza o registro pelo
par atividade/ID do Drive e não repete o evento. Arquivo já removido não é
restaurado. Não há alteração de schema nem limpeza de duplicatas históricas.

## Validação

Testes de navegador em VM cobrem recarga, nova seleção, falha de registro,
resposta perdida, clique repetido, outra conta e storage indisponível. PGlite
cobre repetição concorrente, um único evento e recusa de arquivo removido;
o teste existente continua cobrindo rollback quando o histórico falha.
Interface local conferida em Demandas e Conteúdos, incluindo 390 px e aviso
visível com a aba Link selecionada. A recusa de escrita da demo mantém a
pendência e permite tentar de novo. Nenhum arquivo real foi enviado ou removido.

## Limites

- Recupera o registro após o navegador receber o ID final confirmado pelo Drive.
  Não retoma pedaços incompletos nem recupera uma resposta final do Drive que
  nunca chegou ao navegador.
- Vale neste navegador. Sair da conta ou limpar os dados do site remove o storage
  pelo fluxo de privacidade já existente; não há fila sincronizada entre aparelhos.
- Sem storage disponível, mantém em memória e avisa para não fechar a aba.
- O envio pequeno (até 3 MB), realizado integralmente pelo servidor, não usa
  essa pendência no navegador; o registro no banco também é idempotente por ID.
