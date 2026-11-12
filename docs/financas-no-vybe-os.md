# Financeiro dentro do Vybe OS

Decisão do Paulo (11/11/2026): abolir o Vybe Finanças (`Vybebrasil/vybe-financas`, Supabase) e passar todo o
financeiro para o Vybe OS. O módulo inteiro, salário incluído, é **só dos quatro donos** (regra no servidor).

## Fase 1 — base de dados e importação do histórico (esta)

Ninguém passa a digitar no Vybe OS ainda e nada é desligado no Finanças. O objetivo é o Vybe OS conseguir ler o
próprio banco e dar **os mesmos números** que dá hoje pela ponte (`server/vybe-financas.js`).

| Peça | Onde |
| --- | --- |
| Tabelas e colunas novas | `migrations/2026-11-11-financas-base.sql` (o Paulo aplica à mão no Neon) |
| Importador | `scripts/financas-importar.mjs` (mapeamento e conferência em `server/financas-importacao.js`) |
| Leitura do próprio banco | `server/financas-local.js` |
| Chave da fonte | `VYBE_FINANCAS_FONTE` (`ponte` é o padrão; `local` lê do Vybe OS) |
| Acesso de leitura a mais 3 tabelas do Finanças (opcional) | `docs/vybe-financas-acesso-importacao.sql` |
| Testes | `tests/financas-importacao.test.mjs` |

### Para onde vai cada coisa

| No Finanças | No Vybe OS |
| --- | --- |
| `clients` | `vybe_financas_clientes_origem` (todos, ligados ou não) e `vybe_clientes.financas_cliente_id` (só os ligados) |
| `transactions` INCOME | `vybe_comercial_recebiveis` |
| `transactions` EXPENSE | `vybe_comercial_contas` |
| `transactions` TRANSFER | `vybe_financas_transferencias` |
| `bank_accounts` | `vybe_financas_contas_bancarias` |
| `employees` | `vybe_financas_equipe` (liga a `vybe_pessoas` quando o nome é igual) |
| `employee_compensation_history` | `vybe_financas_equipe_historico` |
| `subscriptions` | `vybe_financas_assinaturas` |
| `contracts` | `vybe_cliente_contratos` (agora vários por cliente) |
| `monthly_budgets` | `vybe_financas_orcamento_mensal` |
| `period_closures` | `vybe_financas_fechamentos` |

Toda linha importada guarda `origem_financas_id` (o uuid de lá). É isso que deixa rodar de novo sem duplicar.
`vybe_financas_vales` nasce vazia: no Finanças o vale não era tabela, era a despesa ligada ao funcionário.

Regras do mapeamento (as da ponte): dia do lançamento em UTC; PAID sem `paid_date` usa o `date`; status fora de
PAID/PENDING vira cancelado. Cliente do Finanças sem par **não vira cliente do Vybe OS**: fica na lista para decidir.

### Ordem de uso (Paulo)

1. Aplicar `migrations/2026-11-11-financas-base.sql` no SQL Editor do Neon. Pode rodar mais de uma vez. Nada muda na tela.
2. (Opcional) Rodar `docs/vybe-financas-acesso-importacao.sql` no Supabase do Finanças, para vir o nome das contas
   bancárias, o orçamento e os meses fechados.
3. Rodar o importador sem gravar e ler o relatório:
   `node scripts/financas-importar.mjs --dry-run` (precisa de `VYBE_FINANCAS_DB_URL` e `DATABASE_URL` no ambiente).
   O critério é **diferença zero** na conferência.
4. Gravar: `VYBE_FINANCAS_IMPORTAR=GRAVAR node scripts/financas-importar.mjs --gravar`. Tudo numa transação; se a
   conferência der diferença, desfaz sozinho.
5. Ligar a chave na Vercel: `VYBE_FINANCAS_FONTE=local` e Redeploy. Para voltar: apagar a variável (ou `ponte`) e Redeploy.
   A variável da Vercel só vale depois de um Redeploy; não precisa de PR nem de mudança de código.

Sem conexão nenhuma dá para ver o importador funcionando com dados inventados: `node scripts/financas-importar.mjs --demo`.

Enquanto o Finanças continuar sendo usado, o importador pode rodar de novo quando quiser: ele atualiza o que mudou lá,
tira o que foi apagado lá e não toca em nada que foi lançado à mão no Vybe OS.

### O que a chave muda (e o que não muda)

- As telas, as contas (`shared/financas-calculos.js`) e o formato da resposta são os mesmos. A resposta ganha
  `origem_dados: 'ponte' | 'local'`.
- Em `local`, lançamento importado continua **só leitura** (id `fin:…`), como hoje. O que é lançado à mão no Vybe OS
  segue pelos caminhos de sempre e nunca aparece em dobro.
- Em `local`, o financeiro é **só dos quatro donos**: as abas de dinheiro do Comercial (Por cliente, Recebimentos,
  Contas a pagar, Inadimplência, Caixa), as ações de dinheiro e as partes `comercial` e `rh` de `area=vybe_financas`
  respondem 403 para quem administra sem ser dono. A Carteira continua mostrando os contratos sem valor para todos.
  Em `ponte` vale a regra de antes (donos e administração) até a troca.
- Em `local` sem importação feita, a rota avisa (502, "ainda não foi importado") em vez de mostrar zero.

### O que fica para as próximas fases

Telas novas, gravação de lançamentos pelo painel, recorrência automática, régua de cobrança, conciliação, projeção,
fechamento do mês pelo painel, o documento mensal da contabilidade e desligar a ponte.
