# Checklist antes de subir

Rode isto no local antes de qualquer deploy. Leva ~10 minutos.

```bash
node dev-server.mjs
```

Abre em `http://localhost:4321`. Serve os arquivos locais e encaminha `/api/*` para
produção — é o app real, com os dados reais do Monday.

> **Atenção:** como a API é a de produção, tudo que você salvar durante o teste
> **grava no Monday de verdade**. Use um item descartável, ou desfaça depois.

---

## A. Fumaça — toda vez que for subir

Marque cada um. Se algum falhar, não suba.

### Abertura
- [ ] A tela "Qual estação você vai operar?" aparece e as 6 estações estão visíveis
- [ ] Console do navegador sem erro em vermelho (F12 → Console)
- [ ] O logo "V · Vybe OS" aparece inteiro no topo, sem nada por cima
- [ ] O botão "☰ Filtros" está no canto inferior esquerdo **com o rótulo**

### Leitura — uma passada por estação
- [ ] **Gestor** — o calendário do mês carrega com conteúdos nos dias
- [ ] **Foco** — escolher um operador mostra a fila dele
- [ ] **DA Controler** — os cards da célula criativa mostram pontos e prazos
- [ ] **Cadastros** — o formulário abre com a lista de clientes preenchida
- [ ] **Produção** — a agenda de captação carrega
- [ ] **Clientes** — a lista de clientes carrega
- [ ] Abas de semana (S1…S6 + **👥 Equipe**) todas visíveis e clicáveis, sem rolar de lado

### Escrita — o que grava no Monday
Use **um item descartável**. Cada linha abaixo dispara uma mutação diferente.

- [ ] **Trocar status** de um item → some do lugar antigo e aparece no novo
- [ ] **Trocar responsável** → salva, e o Monday recebe um update com "anterior → novo"
- [ ] **Mudar prazo** de um item pela mesa individual do DA
- [ ] **Arrastar um item** no calendário do Gestor para outro dia
- [ ] **Criar um conteúdo** pelo Cadastros (rota Produção) → nasce no board certo
- [ ] **Criar uma solicitação** pelo Cadastros (rota Demanda) → nasce no board de Demandas
- [ ] **Comentar** no workspace de um item → o comentário chega no Monday

### Regras de negócio que já quebraram antes
- [ ] Item de **Motion** exige Reriston, Deivid e Beatriz juntos — tentar salvar sem um deles é bloqueado
- [ ] **Prazo de Ouro**: no Cadastros, prazo que não seja 7 dias antes da veiculação é recusado
- [ ] Prazo **depois** da veiculação é recusado em qualquer editor de data

### Fechamento
- [ ] Voltar ao Gestor e apertar "Atualizar Dados" → os números do topo mudam ou confirmam
- [ ] Console ainda sem erro em vermelho

---

## B. Extras — só antes do primeiro deploy desta refatoração

Uma vez só. Depois some daqui.

- [ ] Os 12 `vybe-*.js` carregam com **200** (F12 → Rede, filtrar por "vybe-")
- [ ] Nenhum `404` na aba Rede
- [ ] Texto do calendário legível sem forçar a vista (a fonte mínima subiu para 10px)
- [ ] No **celular**: abrir, escolher uma estação, trocar um status
- [ ] O botão "☰ Filtros" abre a gaveta e o rótulo continua lá depois de abrir e fechar 3x

---

## Onde mexer quando algo quebra

Os 12 módulos carregam **em ordem** e compartilham escopo global.
Não reordene as tags `<script>` no `index.html`.

| arquivo | o que tem dentro |
|---|---|
| `vybe-config.js` | IDs de pessoa, papéis, colunas do Monday, estado global |
| `vybe-core.js` | toast, GraphQL, carregamento, semanas, parsing dos itens |
| `vybe-sync.js` | espelho operacional, cache e reconciliação |
| `vybe-gestor.js` | modo gestor, cards, filtros, KPIs, **trocar responsável** |
| `vybe-risco.js` | risco e SLA, **status**, **datas**, **workspace** |
| `vybe-jarvis.js` | comando por voz e texto |
| `vybe-agenda.js` | aprovações e **calendário mensal** |
| `vybe-perfis.js` | perfis, **cadastros**, **datas em lote do DA** |
| `vybe-demandas.js` | board de solicitações e custos de IA |
| `vybe-clientes.js` | painel de clientes |
| `vybe-relatorios.js` | diário, performance, departamentos |
| `vybe-init.js` | inicialização |

**Trocar alguém de time, renomear cliente ou mudar coluna do Monday:**
só em `vybe-config.js`. Se você precisou editar outro arquivo para isso, é bug —
algum ID escapou de volta para o meio da lógica.

## Verificar CSS sem quebrar layout

Antes de mexer no CSS, no console:

```
fingerprint('ref')
```

Faça a mudança, recarregue, e:

```
fingerprint('cmp')
```

Lista exatamente quais estilos mudaram. Compare em janela curta de tempo — os dados
ao vivo derivam e a assinatura `SPAN.sync-health-copy` muda sozinha, é ruído esperado.
