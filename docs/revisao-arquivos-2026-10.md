# Revisão do fluxo de arquivos — 01/10/2026

Escopo: anexos nas gavetas de Conteúdos e Demandas. Base: `48c4afa`.

## Correções

- Demandas oferece o mesmo controle de envio de Conteúdos, sem outro endpoint.
- Arrastar vários arquivos envia todo o lote. O mesmo campo não inicia outro
  lote enquanto o envio está ativo; falhas parciais identificam os arquivos.
- Releitura compartilhada preserva a gaveta de Demandas e seus rascunhos.
- PDF e vídeo abrem no Drive, em vez de tratar a miniatura como imagem final.
  Imagens com apóstrofo no nome não quebram o comando de abertura.
- Remoção e evento de histórico são gravados em uma transação PostgreSQL.
  IDs de arquivo inválidos são recusados antes de consultar o banco.
- O controle de envio compartilhado aceita foco e ativação pelo teclado.

## Evidências

- `npm run check`: 229 testes aprovados, sintaxe e build aprovados.
- `git diff --check` aprovado.
- PGlite: operador sem perfil de administrador remove o arquivo da atividade;
  arquivo de outra atividade, arquivo legado e ID inválido são recusados.
  Falha do Drive mantém o registro; falha do histórico reverte a alteração no
  banco; releitura após sucesso mantém a remoção e seu autor.
- Testes de navegador em VM: lote múltiplo, bloqueio de envio duplicado, falha
  parcial, PDF, nomes com apóstrofo e atualização da gaveta correta.
- Navegador local: Conteúdos e Demandas em desktop e 390 px, sem erro no console
  ou overflow horizontal; foco do controle de envio conferido. Gaveta rola e
  o fundo permanece bloqueado. Anexo usado na tela era fictício.

## Limites

Não houve envio ou exclusão no Drive real, uso da sessão pessoal do Deivid,
publicação, alteração de esquema nem gravação em produção. A demo é somente
leitura; persistência foi testada no PostgreSQL em memória.

Drive e PostgreSQL não compartilham transação: se o Drive concluir a remoção e
for impossível gravar no banco, a chamada ainda falha e requer nova tentativa.
A transação agora impede que a marca de remoção seja salva sem seu histórico,
mas não implementa compensação entre serviços. Upload grande em partes e
recuperação real da lixeira não foram executados nesta revisão.
