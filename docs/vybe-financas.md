# Vybe Finanças dentro do Vybe OS (só leitura)

Decisão do Paulo (08/11/2026): o dinheiro da agência mora no **Vybe Finanças** (repositório
`Vybebrasil/vybe-financas`, Supabase). O Vybe OS **só lê** o Postgres de lá, com um papel próprio que
só tem `SELECT`, e mostra os números no Comercial, na Carteira e no RH. Nada é gravado no Finanças.

## Passo a passo para ligar (Paulo)

1. **Rodar o SQL de acesso no Supabase do Finanças**
   - Abra o projeto do **Vybe Finanças** no Supabase → **SQL Editor** → **New query**.
   - Cole o conteúdo de [`docs/vybe-financas-acesso-leitura.sql`](vybe-financas-acesso-leitura.sql).
   - No topo do script, troque:
     - `TROQUE-ESTA-SENHA` por uma senha forte nova (16 caracteres ou mais; só letras e números evita
       ter que codificar caracteres na URL). O script se recusa a rodar com a senha de exemplo.
     - o e-mail `gestaovybe@gmail.com`, se o dono da conta da Vybe no Finanças for outro.
   - Clique em **Run**. O resultado final mostra, por tabela, quantas linhas o papel vai enxergar
     (as do dono da Vybe), as tabelas com `SELECT` e quantas políticas foram criadas. A linha
     "outras permissoes (deve ser 0)" tem que dar 0.
   - Pode rodar de novo quando quiser (troca a senha e recria as políticas). Para desligar, use o
     bloco comentado no fim do script.

2. **Montar a string de conexão (pooler em modo transação)**
   - No Supabase do Finanças: **Project Settings → Database → Connection pooling** (em algumas telas,
     botão **Connect** no topo → **Transaction pooler**).
   - Copie a string do modo **Transaction**, porta **6543**. Ela tem o formato
     `postgresql://postgres.<ref-do-projeto>:[SENHA]@aws-0-<região>.pooler.supabase.com:6543/postgres`.
   - Troque o usuário `postgres` por `vybe_os_leitura` (fica `vybe_os_leitura.<ref-do-projeto>`) e
     `[SENHA]` pela senha que você pôs no script.

3. **Criar a variável na Vercel do Vybe OS**
   - Projeto do Vybe OS na Vercel → **Settings → Environment Variables**.
   - Nome: `VYBE_FINANCAS_DB_URL`, valor: a string do passo 2, ambiente: **Production**.
   - Publique de novo (Redeploy) para a variável valer.

Sem a variável, as telas mostram **"Conectar o Vybe Finanças"** com este passo a passo (só para quem
vê dinheiro) e tudo continua como antes.

## O que muda nas telas

| Onde | Com o Finanças ligado (fonte: Vybe Finanças) |
| --- | --- |
| Comercial → **Finanças por cliente** | No topo, o mês escolhido: recebido × previsto, despesas do mês, folha do mês (só o total), custos fixos (assinaturas ativas), resultado, em atraso e clientes com margem negativa. Gráficos de 6–12 meses: faturamento × custos e ticket médio. **Margem real por cliente** (recebido − despesas ligadas ao cliente, no mês e em 3 meses). Os cartões de cada cliente continuam (pacote, margem estimada e status à mão) e ganham a margem real. |
| Comercial → **Contas a pagar** | Despesas do mês por categoria (pago e pendente), folha e assinaturas. As contas lançadas no Vybe OS ficam abaixo, editáveis, sem os cartões de total (o total vem do Finanças). |
| Comercial → **Inadimplência** | Receitas vencidas e não pagas por cliente (o atraso mais antigo manda a cor). As faturas lançadas no Vybe OS e os marcados à mão continuam embaixo. |
| Comercial → **Caixa** | A previsão segue com os recebíveis e contas do Vybe OS; um aviso aponta o realizado do Finanças. |
| Carteira → **Contratos** | Os contratos do Finanças (valor, início, fim, assinatura, dia de vencimento, status, PDF) entram no lugar do registro do Vybe OS do mesmo cliente e alimentam a lista, o LTV e o tempo restante. Os clientes do Finanças **sem par no Vybe OS** aparecem num número clicável. Contrato que vem do Finanças não tem "Editar" aqui: muda-se no Finanças. |
| Pessoas → RH → **Folha** | Só para os quatro donos: funcionários, cargo, salário, bônus, dia de pagamento, total do mês e a variação contra o mês anterior (pelo histórico de remuneração). |

Os números novos abrem o mini painel ao clicar (`data-espiar="financas:…"`).

## Quem vê o quê (decidido no servidor)

- `parte=comercial`: só quem já vê dinheiro no Comercial (`pode.ver_dinheiro`: donos e administração).
  A folha vai só como total: nenhum nome nem salário de funcionário sai nesta parte.
- `parte=carteira`: toda sessão pessoal; o **valor** de cada contrato só para quem vê dinheiro.
- `parte=rh`: só os quatro donos (Paulo, Vinícius, Ewerton e Deivid, pelo primeiro nome).
  Administração sem ser dono não recebe salário individual.

Rota: `GET /api/painel?area=vybe_financas&parte=comercial|carteira|rh&mes=AAAA-MM`
(`server/vybe-financas-api.js`). Contas em `shared/financas-calculos.js` (testadas em
`tests/vybe-financas.test.mjs`).

## Como lê (técnico)

- `server/vybe-financas.js`: pacote `postgres` (porsager) com `prepare: false`, `max: 1`,
  `idle_timeout: 20`, `connect_timeout: 6`, `ssl: 'require'`. Cada leitura numa transação
  `BEGIN READ ONLY` com `statement_timeout` de 6 s, só `SELECT`. O papel também tem
  `default_transaction_read_only = on`.
- Tabelas e colunas lidas:
  - `clients`: id, name, cnpj, monthly_fee, due_day, contract_status
  - `transactions`: id, description, amount, type, category, date, paid_date, status, client_id, employee_id
    (só as dos últimos 12 meses até o mês escolhido e todas as pendentes)
  - `employees`: id, name, role, salary, bonus, payment_day
  - `employee_compensation_history`: employee_id, effective_month, salary, bonus (se existir)
  - `subscriptions`: id, name, cost, renewal_day, active
  - `contracts`: id, client_id, title, amount, status, start_date, signed_date, end_date, due_day e se há
    `pdf_url`/`pdf_file_name` (só sim/não; o link do PDF não sai)
  - Colunas de migrações mais novas (paid_date, employee_id, bonus, signed_date, pdf_*) e as tabelas
    opcionais são conferidas no `information_schema` antes de ler.
- Cache em memória por consulta: 3 min; falha fica guardada 30 s. Erro vira uma frase em português,
  sem a URL, a senha ou a mensagem do Postgres.
- Ligação de clientes Finanças × Vybe OS: CNPJ (14 dígitos) quando os dois têm; senão o nome sem
  acento, minúsculo, sem pontuação e sem `ltda`/`me`/`eireli`, só se houver um único cliente do
  Vybe OS com aquele nome.
