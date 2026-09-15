# Esquema da leitura incremental

Antes de publicar esta versão, confira o esquema do banco de destino. As leituras
de conteúdo agora apenas verificam colunas, visão e os seis gatilhos; não executam
ALTER TABLE, CREATE ou UPDATE de preparação. Em esquema incompleto, a leitura falha
explicitamente e não marca a conexão como pronta.

Com `DATABASE_URL` fornecida pelo ambiente seguro de administração, execute:

```sh
npm run db:migrate
```

O comando acrescenta as colunas ausentes, preenche a ordem das etiquetas sem ordem,
recria a visão e os gatilhos e verifica o resultado. Pode ser repetido após uma falha.
Ele pressupõe as tabelas operacionais existentes; não instala um banco vazio.
As alterações são agrupadas em uma transação: uma falha reverte o conjunto, inclusive os gatilhos.
Não inclua o comando no build público nem o execute com credenciais de produção em testes.

O cache de prontidão é por conexão. Uma conexão a outro banco não herda o resultado.
São verificados tabela, função, eventos e estado habilitado de cada gatilho. Isto
não verifica o corpo de funções já existentes; a migração reinstala as definições.

Os testes usam exclusivamente PGlite local. Nenhuma migração de produção foi executada
durante esta alteração. Outros fluxos administrativos legados ainda possuem preparação
de esquema própria; a separação aqui cobre o caminho de leitura de conteúdos.

# Aparência

`vybe-appearance.css` centraliza superfícies, controles e acessibilidade dos módulos.
`vybe-appearance.js` mantém preferências locais de vidro e movimento, sem acessar APIs.
O build gera hashes para essa folha de estilos e para o módulo, como para o restante
do frontend. O botão Aparência existe na entrada e na barra da operação.
