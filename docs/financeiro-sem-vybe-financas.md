# Financeiro do Vybe OS sem o Vybe Finanças

Pedido do Paulo em 13/11/2026: "quero me livrar 100% do Vybe Finanças". Daqui em diante o controle financeiro todo é
feito no módulo Finanças do Vybe OS, com o extrato da conta PJ como base. Este documento junta o levantamento, a
referência do Conta Azul, o que entrou neste PR e o plano para cortar a dependência.

## 1. O que existe hoje (levantamento de 13/11/2026)

**Telas** (dock → Finanças, só os quatro donos: `TRANCADOS` em `vybe-mundo.js`):
- Visão geral (`vybe-mundo-setor.js` → `VybeFinancas.telas.visao`), Por cliente, Recebimentos, Contas a pagar e
  Inadimplência, na janela do Comercial (`vybe-mundo-comercial.js`, telas v2 em `vybe-mundo-financas.js`).
- Caixa (`abaCaixa`) e Fornecedores, também na janela do Comercial.
- Um link externo "Vybe Finanças" (`vybe-financas.vercel.app`).

**Servidor:**
- `server/comercial.js`: recebíveis (`vybe_comercial_recebiveis`), contas (`vybe_comercial_contas`), finanças por
  cliente (`vybe_comercial_financas_cliente`), caixa e fornecedores. Cálculos em `shared/comercial-calculos.js`.
- `server/vybe-financas-api.js` + `server/vybe-financas.js` (a "ponte"): leitura só de consulta do Supabase do Finanças
  (`VYBE_FINANCAS_DB_URL`, tabelas `clients`, `transactions`, `employees`, `employee_compensation_history`,
  `subscriptions`, `contracts`). Cálculos em `shared/financas-calculos.js`.
- `server/financas-local.js` + `server/financas-importacao.js` (fase 1, PR #648): o mesmo formato tirado das tabelas
  do Vybe OS, escolhido por `VYBE_FINANCAS_FONTE` (padrão `ponte`; `local` só com o valor exato).

**O que ainda lê ou escreve no Vybe Finanças:**

| Onde | O quê | Tela que depende |
| --- | --- | --- |
| `server/vybe-financas-api.js` (`conectorDaFonte`) | `area=vybe_financas` pela ponte | Visão geral, Contas, Inadimplência, Por cliente, Caixa; Carteira › Contratos; RH › Folha; Gestão › Agência |
| `server/comercial.js` (`doFinancas`) | com a ponte no ar, substitui as tabelas locais | Recebimentos, Contas, Inadimplência, Caixa, Por cliente (o lançado à mão some dessas abas) |
| `api/painel.js` (`ecossistemaDoCliente`) | `conectorPadrao()` direto, ignora `VYBE_FINANCAS_FONTE` | Ficha do cliente › Ecossistema |
| `api/painel.js` (`levarAoFinancas`) + `server/vybe-financas-cadastro.js` | **escreve** o cliente no Finanças (`VYBE_FINANCAS_CADASTRO_URL`) | Cadastro de cliente |
| `vybe-mundo.js`, `mundo/planta.mjs`, `server/clientes-cadastro.js` | links para `vybe-financas.vercel.app` | dock, prédio, ficha |

## 2. Referência do Conta Azul (conta da Vybe, lida em 13/11/2026)

A conta está em teste e sem lançamentos, então foi lida a estrutura das telas, não dados. Ignorado: vendas de produto,
estoque, CMV, NF de produto.

| No Conta Azul | O que adotamos |
| --- | --- |
| Extrato de movimentações + conciliação | **Extrato e conciliação**: importar o extrato do banco, lado do banco × lado real, conferir um a um |
| Lançamento com rateio de categoria/centro de custo | **Dividir** uma entrada entre clientes ou uma saída em categorias (as partes têm que somar o valor do banco) |
| Data de competência × data de pagamento ("Visão de competência") | **Mês a que se refere** em cada lançamento e em cada parte (a mensalidade de outubro paga em novembro) |
| Categorias financeiras (3.01 Receitas de serviços, 3.02 Financeiras, 3.03 Outras…) | Categorias próprias agrupadas (Receitas, Pessoas, Sócios, Operação, Estrutura, Banco, Empréstimos…) |
| Despesa com "Repetir lançamento" | **Gastos fixos**: o que se repete, com dia, forma de pagar e se já saiu no mês |
| Pago / Agendado | **Pago / Não pago / Em aberto** em cada lançamento e em cada item do cartão |
| Inadimplentes, posição por cliente | **Clientes mês a mês**: mensalidade contra o que entrou, por mês de referência |
| Conta financeira tipo cartão de crédito | **Cartão de crédito**: itens da fatura, quitada pelo pagamento no extrato |
| Fluxo de caixa diário/mensal, DRE caixa, DRE gerencial | **Relatórios e projeção**: fluxo realizado, resultado por grupo (DRE de caixa) e projeção 3/6/12 meses com cenários |
| Importar despesas com IA | Fica para o Vorcaro (grupo Vybe Financeiro), ver o item 5 |

Ficou de fora por agora: centro de custo separado de categoria (cliente já cumpre esse papel), DDA, conciliação
automática por integração bancária (o BB exige convênio; o CSV resolve), agendador de relatórios.

## 3. O que este PR entrega

- `shared/financeiro-extrato.js`: leitor do CSV do BB PJ (Windows-1252, `;`, vírgula decimal, cabeçalho de agência e
  conta, do mais novo para o mais antigo), ids estáveis (reimportar não duplica), regras automáticas, lado real
  editável, partes, resumo do mês, cliente × mês, cartão, gastos fixos e projeção. Funções puras, testadas.
- `server/financeiro.js` + `area=financeiro` em `api/painel.js`: só os quatro donos (`ehDonoPessoa`; administração
  não entra). Prévia do CSV sem gravar; importar grava. Tudo em `vybe_carteira_config` (chaves `financeiro_*`), **sem
  migração**, cada escrita numa transação com `FOR UPDATE`.
- `vybe-mundo-financeiro.js` + `padrao-v2/financeiro.css`: as cinco telas no padrão v2, no dock de Finanças.
- Regras que já vêm prontas (o Paulo confirma): parcela de empréstimo (`PARC xx/046`), tarifas, juros do limite,
  rendimento, boleto recebido ("Cr Cob Bloq…", para dividir), débito da fatura do cartão, Pix para o Vinícius = pagar o
  cartão da agência (a conferir), Pix para o Paulo = alimentação (a conferir), Pix para Ewerton/Deivid = pró-labore (a
  conferir), 99 = transporte. Pix recebido com o nome de um cliente já vem ligado a ele (a conferir). O Paulo cria as
  dele no próprio lançamento ("Sempre que aparecer X, fazer assim"), como a do Mizinho = combustível.
- Demo local: `DEMO_DONO=1` mostra Finanças ao operador da demo; `area=financeiro` roda o servidor de verdade num
  PGlite em memória com um extrato **fictício** (`scripts/fixtures-financeiro.mjs`).

## 4. Plano para cortar o Vybe Finanças

1. **Agora (este PR, sem mexer em produção):** o extrato passa a ser a fonte do realizado. Nada do Finanças é lido nas
   telas novas.
2. **Importar os 3 meses de extrato em produção**: só com o OK do Paulo depois de ver a prévia (é escrita em banco
   real). Pela tela: Finanças › Extrato e conciliação › Importar extrato → prévia → "Importar N lançamentos".
3. **Pente fino com o Vinícius**: conferir os lançamentos marcados "a conferir", dividir os boletos, cadastrar os fixos
   e os itens do cartão.
4. **Trocar as telas antigas para a fonte nova** (PR seguinte): Visão geral, Por cliente, Inadimplência e Caixa lendo
   do extrato + contratos em vez de `area=vybe_financas`; Recebimentos e Contas a pagar continuam como agenda do que
   vai entrar/sair e passam a "conciliar" com o lançamento do extrato quando ele aparecer.
5. **Histórico antigo**: decidir com o Paulo se o histórico do Finanças anterior ao extrato entra (a fase 1, PR #648,
   já sabe importar para as tabelas do Vybe OS) ou fica só para consulta.
6. **Desligar**: `VYBE_FINANCAS_FONTE=local` (ou remover a ponte), tirar `levarAoFinancas`/`vybe-financas-cadastro.js`,
   o `ecossistemaDoCliente` pela ponte e os links `vybe-financas.vercel.app`. Depois disso, as variáveis
   `VYBE_FINANCAS_DB_URL` e `VYBE_FINANCAS_CADASTRO_URL` podem sair da Vercel (o Paulo faz).
7. **Volume**: guardar em `vybe_carteira_config` serve para alguns milhares de lançamentos. Passando disso (ou quando o
   Vorcaro começar a lançar todo dia), vira tabela própria com migração revisada pelo Paulo; o formato de cada
   transação já é o de uma linha.

## 5. Vorcaro (Tesouraria) e o grupo Vybe Financeiro

Pedido do Paulo no mesmo dia: "executar a tela dele junto, pra ele ajudar a controlar esse setor todo".

**No Vybe OS (este PR):** Finanças › Vorcaro · Tesouraria (primeira tela do grupo no dock).
- "O que eu vi": a análise do setor inteiro, do mais sério ao mais leve, cada achado com "Resolver" que leva à tela certa
  (conta no negativo, caixa negativo na projeção, juros do limite, lançamentos a conferir, boletos para dividir,
  clientes em aberto, fixos que venceram e não saíram, pagamento de cartão sem fatura, itens sem categoria, a saída que
  mais cresceu no último mês fechado).
- "Chegou pelo WhatsApp": as propostas do grupo, já com a sugestão. Um dono edita e escolhe: **juntar** com o
  lançamento do banco (mesmo valor, até 5 dias; a classificação vai para o lançamento do banco, sem contar duas vezes),
  **lançar** à parte (dinheiro que não passou pela conta: vira lançamento sem saldo, marcado "WhatsApp") ou
  **descartar**. "Lançar à mão" faz o mesmo sem passar pelo grupo.
- Porta do bot: `POST /api/painel?area=financeiro&canal=bot` com `Authorization: Bearer <VYBE_AI_BOT_TOKEN>` e
  `{ acao: 'propor', propostas: [{ id_externo, autor, texto, anexo: print|audio|mensagem, tipo: entrada|saida, valor,
  data, categoria, quem, cliente_nome }] }`. Só cria pendente (repetir o `id_externo` não duplica); não lê lançamento
  nem saldo. `GET` na mesma porta devolve as categorias, para o bot sugerir com os mesmos ids.

**No bot (C:\whatsapp-ia, ainda não feito):** ligar o grupo Vybe Financeiro com tratamento próprio (fora do resumo da
manhã e do espelho), ler print (visão), áudio (transcrição) e texto, montar a proposta e mandar pela porta acima. O
grupo continua fora de `GRUPOS_VYBE` até isso existir. Exige reiniciar o bot, então só com o OK do Paulo.
