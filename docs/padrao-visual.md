# Manual de marca e design system do Vybe OS — Irecity (vigente desde 07/11/2026)

Este é o padrão de toda tela do Vybe OS. Ele substitui a direção escura de 27/10/2026
(`vybe-padrao.css`, vidro grafite), que continua carregando só enquanto existirem telas do
modo legado e do Escritório (Habbo). Quando o Irecity tiver todas as funções do legado, o
Paulo remove o legado e o Habbo; até lá, **nada novo é desenhado no visual escuro**.

Fonte dos tokens: `vybe-mundo.css` (`:root`, prefixos `--vv-` e `--ds-`). As regras de
componentes estão nos blocos "DESIGN SYSTEM" no fim do arquivo: elas vêm por último e vencem
as regras antigas.

---

## 1. Ideia

Uma maquete de Irecê viva, vista de cima, com a Vybe no meio. Por cima dela, janelas de vidro
claro (papel fosco) que mostram o trabalho. O mapa é o fundo e o contexto; o vidro é onde se lê e
se decide. Claro, quente, legível e calmo: **cor só onde ela significa algo**.

Princípios (inspirados no macOS atual: vidro, camadas, controles em cápsula):
1. **Camadas**: mapa → ilhas de vidro (HUD) → placas → janelas. Cada camada mais opaca que a de baixo.
2. **Um destaque por tela**: só um botão laranja cheio por área. Todo o resto é secundário.
3. **Urgência manda na cor**: vermelho cheio só para o que está atrasado ou falhou.
4. **Raios concêntricos**: o que está dentro tem raio menor que o que o contém.
5. **Nada cobre nada**: tudo cabe na tela, tem fechar visível e fecha com Esc.

## 2. Cores da marca

| Token | Valor | Uso |
|---|---|---|
| `--vv-papel` | `#F6F3EE` | fundo das telas e dos módulos |
| `--vv-branco` | `#FFFFFF` | cartões, linhas, campos, janelas |
| `--vv-tinta` | `#1F1D1A` | texto principal |
| `--vv-apagado` | `#6B675F` | texto de apoio (mínimo 4,5:1 sobre branco) |
| `--ds-linha` | `#E6E0D6` | bordas e divisórias |
| `--ds-acao` | `#FF7A2F` | **a** cor da Vybe: ação principal (botão Criar) |
| `--ds-acao-hover` | `#E8602E` | hover da ação e sombra laranja |
| `--ds-sel-fundo` | laranja 13% sobre branco | fundo do item selecionado |
| `--ds-sel-texto` | `#C2490C` | texto do item selecionado e links |
| `--vv-lilas` | `#8B7DFF` | o VYBES (ser, núcleo, agentes) |

**Proibido:** degradê em botão, laranja escuro chapado, cinza-grafite de fundo, neon (azul `#7AA7FF`,
verde `#00D184`, rosa `#FF637A`) como texto sobre claro.

## 3. Escala de urgência (a cor diz o que fazer primeiro)

| Nível | Quando | Visual |
|---|---|---|
| 1 Crítico | atrasado, falhou | **vermelho cheio** `#D93D42`, texto branco, barra vermelha na linha |
| 2 Alto | vence hoje | âmbar `#FFF1CC` com borda `#F3D48B`, texto `#8A5A00`, barra âmbar na linha |
| 3 Bloqueio | alteração pedida / falta informação | rosa `#FCE7F1`/`#A3366F` · lilás `#F1EAFD`/`#6E3DB8` |
| 4 Espera | aguardando aprovação do cliente | azul `#EAF1FF`/`#1F4FA8` |
| 5 Neutro | sem responsável, sem dado | cinza `#F1F2F3`/`#5B6268` |
| 6 Andando | em execução, em dia, concluído | verde `#E7F6EE`/`#11613A` |

Regras: só o nível 1 é cheio. Numa lista, o olho deve achar o vermelho em 1 segundo. Números de
resumo seguem a mesma escala (ex.: "atrasados" em vermelho, "hoje" em âmbar). Laranja **não** é
cor de urgência: é a marca e a ação.

Cores de **categoria** (setores do prédio, áreas do Cérebro, formatos) são identificação, não
urgência: aparecem em pontos, barras finas e avatares, nunca como fundo cheio de botão.

## 4. Tipografia

| Papel | Fonte | Tamanho / peso |
|---|---|---|
| Título de tela | Space Grotesk | 24–28px / 700, `letter-spacing:-.02em` |
| Título de cartão/janela | Space Grotesk | 17–19px / 700 |
| Texto | sistema | 13px / 500 |
| Apoio | sistema | 11–12px / 500, `--vv-apagado` |
| Rótulo de seção (kicker) | sistema | 10–11px / 700, maiúsculas, `.12em`, `#A84E00` |
| Botão | sistema | 12,5px / 600 (ação principal 700) |
| Número de KPI | sistema | 20–28px / 800, `tabular-nums` |

## 5. Escalas

- **Raio**: 8 (chip interno) · 12 (botão, campo) · 18 (cartão) · 24 (janela) · 999 (pílula).
- **Altura**: 28 (compacto/chip) · 34 (botão) · 38 (campo) · 40 (destaque).
- **Espaço**: 4 · 8 · 12 · 16 · 24 · 32.
- **Sombra**: curta `0 1px 2px` + `0 8px 24px` a 5% (cartões); janela `0 30px 80px` a 25%; ação laranja `0 8px 20px -8px #E8602E`.
- **Foco de teclado**: anel `0 0 0 3px rgba(255,122,47,.22)` em tudo.

## 6. Componentes

| Componente | Especificação |
|---|---|
| **Ação principal** | igual ao botão **Criar** do dock: `#FF7A2F` cheio, texto branco 700, raio 12–14, sombra laranja. Um por área. Ex.: Novo conteúdo, Salvar, Continuar, Entrar no andar, Abrir contexto. |
| **Secundário** | branco, borda `--ds-linha`, texto tinta 600; hover borda laranja e texto `#C2490C`. |
| **Perigo** | branco com contorno vermelho `#F6BBC4`, texto `#B42318`; cheio só na confirmação. |
| **Link** | texto `#C2490C` 700, sem fundo. |
| **Selecionado** (aba, filtro, segmento, dia, pessoa) | igual ao **Gestor** no dock: fundo laranja 13%, texto `#C2490C`, sem sombra. Nunca laranja cheio. |
| **Pílula / chip** (pessoa, carteira, visão) | branco, borda, raio 999, 28px; a cor da pessoa só no avatar ou numa barra fina à esquerda. |
| **Etiqueta de estado** | pílula 11px 700 na cor da escala de urgência. |
| **Campo** | branco, borda, raio 12, 38px; foco borda laranja + anel. `color-scheme:light`. |
| **Cartão** | branco, borda, raio 18, sombra curta. Clicável: sobe 1px no hover. |
| **Janela** (briefing, status, cadastro, reunião) | branca, raio 24, sombra de janela, fundo atrás `rgba(31,29,26,.3)` com blur; título 17–19px; fechar (×) no canto; Esc fecha. |
| **Menu suspenso** (status, responsável, ferramentas, avisos) | branco **opaco**, raio 16, borda e sombra; nunca translúcido escuro. |
| **Painel lateral** (detalhes da peça, mesa de comando) | branco, borda à esquerda, cabeçalho fixo branco. |
| **Tabela** | cabeçalho 9,5px 700 maiúsculas `#6B675F`; linhas com divisória `#F0EBE3`; números à direita em `tabular-nums`; hover `#FAF5EE`. |
| **KPI** | número grande + rótulo curto; cor da escala só no número que pede ação. |

## 7. Estrutura da tela

- **Dock da esquerda (trilho)**: fica. É a navegação entre módulos; o botão **Criar** é a referência da ação principal e o **item atual** é a referência de selecionado.
- **Barra do topo, uma só**: ferramentas (buscar, avisos, notas, camadas, aparência, conta) | divisor | vistas (Cidade, Prédio, Cérebro).
- **Seu dia** à esquerda; **Agenda** à direita; **controles do mapa** embaixo à direita; **barra de voz** embaixo, depois do Seu dia.
- **Placas** (Elevador, andar, agente) à direita e estreitas; o mapa nunca fica coberto por mais de um terço.
- **Módulo aberto**: moldura de vidro com rolagem por dentro; no canto, **tela cheia** (F) e **fechar** (×).
- **Esc** fecha de cima para baixo: janela → lista da chamada → placa → andar → módulo → cidade.

## 8. Mapa e prédio

- Recorte em disco centrado perto da Vybe (R. São Francisco, 194), todos os clientes dentro, moldura lisa.
- Casas do interior: parede clara colorida, barrado, porta, janelas com moldura; laje com platibanda e caixa d'água ou telhado de barro com cumeeira e beiral; muro baixo com portão; quintais de grama e terra.
- Nomes nunca empilhados: nome comum que encosta some; pino de cliente que encosta vira "+N".
- Prédio da Vybe: concreto claro, brise de madeira, vidro claro, coluna laranja com VYBE, faixa de luz por andar na cor da situação; salas com tapete na cor do setor, mesa, monitores (um aceso na cor do estado do agente), cadeira, estante, planta e telão.

## 9. Ícones

Traço 1,8–2px, pontas arredondadas, 18–20px, `currentColor`. Coloridos onde identificam (abas,
módulos, setores), com tinta suficiente para o claro; neutros nas ferramentas.

## 10. Movimento

Entrada de janela: opacidade + escala .97 → 1 em 200ms (usando `scale`/`translate` separados, para não
desmontar quem se centraliza com `transform`). Hover: 150ms. Respeitar "Reduzir movimento".
O mapa só redesenha quando algo muda.

## 11. Checklist de toda tela nova

1. Só tokens `--vv-*`/`--ds-*`; nada de grafite, degradê em botão ou neon como texto.
2. Uma ação principal (laranja cheio) por área; selecionados em laranja 13%.
3. Urgência pela escala do item 3; vermelho cheio só para atrasado/falhou.
4. Contraste: 4,5:1 texto, 3:1 ícone e texto grande. (Exceção aceita: texto branco 700 na ação principal.)
5. Raios e alturas das escalas do item 5.
6. Fechar visível, Esc fecha, nada abre fora da tela, menus opacos.
7. Conferida com dados reais, em 6 tamanhos de tela, abrindo **todas** as janelas e menus.
