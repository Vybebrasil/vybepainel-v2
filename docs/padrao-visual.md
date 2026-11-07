# Padrão visual do Vybe OS — Irecity (vigente desde 07/11/2026)

Este é o padrão de toda tela do Vybe OS. Ele substitui a direção escura de 27/10/2026
(`vybe-padrao.css`, vidro grafite), que continua carregando só enquanto existirem telas do
modo legado e do Escritório (Habbo). Quando o Irecity tiver todas as funções do legado, o
Paulo remove o legado e o Habbo; até lá, **nada novo é desenhado no visual escuro**.

Fonte dos tokens: `vybe-mundo.css` (`:root`, prefixo `--vv-`).

## 1. Ideia

Uma maquete de Irecê viva, vista de cima, com a Vybe no meio. Por cima dela, janelas de
vidro claro (papel fosco) que mostram o trabalho. O mapa é o fundo e o contexto; o vidro é
onde se lê e se decide. Claro, quente, legível e calmo; cor só onde ela significa algo.

## 2. Cores

| Token | Valor | Uso |
|---|---|---|
| `--vv-papel` | `#F6F3EE` | fundo das telas e dos módulos |
| `--vv-branco` | `#FFFFFF` | cartões, linhas de tabela, campos |
| `--vv-tinta` | `#1F1D1A` | texto principal |
| `--vv-apagado` | `#6B675F` | texto de apoio (mínimo 4,5:1 sobre branco) |
| `--vv-linha` | `#E6E0D6` | bordas e divisórias |
| `--vv-laranja` | `#FF7A2F` | marca, destaque, ícone ativo |
| `--vv-acao` | `#C2490C` | botão principal e item selecionado (texto **branco**) |
| `--vv-laranja-claro` | `#FFE6D6` | fundo de destaque suave |
| `--vv-lilas` | `#8B7DFF` | o VYBES (ser, núcleo, agentes) |

Situação (andares, peças, agentes) — sempre com texto escuro ou branco, nunca a cor pura como texto:

| Situação | Cor | Fundo claro | Texto |
|---|---|---|---|
| em dia / ok | `#18A957` | `#E7F6EE` | `#11613A` |
| pede atenção / aprovar | `#E2A11B` | `#FFF4DC` | `#8A5A00` |
| atrasado / falhou | `#D93D42` | `#FDECEE` | `#B42318` |
| sem sinal / inativo | `#9AA3A8` | `#F1F2F3` | `#5B6268` |

**Regras de contraste:** texto normal ≥ 4,5:1; texto grande/negrito e ícones ≥ 3:1.
Cores neon feitas para o fundo escuro (azul `#7AA7FF`, verde `#00D184`, rosa `#FF637A`,
laranja `#FF8B2B`) não servem como texto no claro: escurecer (ex.: `filter:saturate(1.4) brightness(.58)`)
ou trocar pelo par "Texto" da tabela. Ícones coloridos continuam coloridos, com tinta suficiente.

## 3. Superfícies

| Token | Uso |
|---|---|
| `--vv-vidro` `rgba(250,248,244,.80)` + `--vv-desfoque` `blur(18px) saturate(1.5)` | ilhas do HUD sobre o mapa (topo, trilho, controles) |
| `--vv-vidro-forte` `rgba(251,250,247,.94)` | placas e barras com leitura (Elevador, chamada, agenda) |
| `#FFFFFF` + borda `--vv-linha` | cartões, janelas (briefing, avisos, aparência), menus |
| `--vv-sombra-curta` | ilhas e cartões; `--vv-sombra` só em janela por cima de tudo |

Raios: placa 26px, cartão 18px, item 13px, botão 11px. Fundo atrás de janela: `rgba(31,29,26,.28–.32)` com blur leve.
Controles nativos (`select`, caixa de marcar, data) sempre com `color-scheme:light`.

## 4. Tipografia

- Títulos: **Space Grotesk** 700, `letter-spacing:-.01em` a `-.02em` (`--vv-titulo`).
- Texto: fonte do sistema (`--vv-texto`), 500 para apoio, 700 para nomes e números.
- Rótulo de seção (kicker): 700, 10–11px, maiúsculas, `letter-spacing:.12em`, cor `#A84E00`.
- Números grandes (KPIs): 800, 20px+, tinta.

## 5. Estrutura da tela

- **Dock da esquerda (trilho)**: fica. É a navegação entre módulos (Hoje, Tarefas, Criar, Gestor…).
- **Barra do topo, uma só**: ferramentas (buscar, avisos, notas, camadas, aparência, conta) | divisor | vistas (Cidade, Prédio, Cérebro).
- **Seu dia** à esquerda; **Agenda** à direita; **controles do mapa** no canto inferior direito.
- **Placas** (Elevador, andar, cliente) à direita, estreitas; o mapa nunca fica coberto por mais de um terço.
- **Barra de chamada** embaixo, depois do painel Seu dia.
- **Módulo aberto**: moldura de vidro com a rolagem por dentro; no canto, **tela cheia** (F) e **fechar** (×).
- **Esc** fecha de cima para baixo: janela → lista/cartão da chamada → placa → andar → módulo → volta à cidade.

## 6. Mapa (maquete de Irecê)

- Recorte em disco, centrado perto da Vybe (R. São Francisco, 194), com todos os clientes ativos dentro.
- Casas do interior: parede clara colorida, barrado no rodapé, porta, janelas com moldura e peitoril;
  laje com platibanda e caixa d'água azul sobre base, ou telhado de barro com cumeeira e beiral; muro baixo com portão.
- Quintais em grama e terra; ruas com calçada clara; árvores nas ruas; animais só de perto.
- Lugares fora do recorte (Atacadão, AGES, UNEB) viram placa na borda com a distância real.
- **Nomes**: nunca empilhados. Nome comum que encosta noutro some; pino de cliente que encosta noutro vira "+N".
  Na vista do prédio, só o prédio, os andares e o VYBES.

## 7. Prédio da Vybe

- Concreto claro nas lajes e pilares, vidro claro, brise de madeira atrás e à esquerda (a luz das salas aparece entre as ripas),
  coluna laranja na quina com o letreiro VYBE, marquise laranja acesa no térreo, jardineiras nos andares.
- Faixa de luz em cada andar com a cor da situação.
- Praça em volta: canteiros, bancos, bicicletário e totem com a marca.
- O VYBES (ser lilás/laranja) flutua sobre o terraço.

## 8. Ícones

Traço de 1,8–2px, cantos e pontas arredondados, 18–20px, `currentColor`. Coloridos onde identificam
(abas, módulos); neutros nas ferramentas; branco sobre `--vv-acao` quando selecionado.

## 9. Movimento

`--vv-suave` para entrar/sair, `--vv-mola` para toques. Respeitar "Reduzir movimento".
O mapa só redesenha quando algo muda (render sob demanda).

## 10. Checklist de toda tela nova

1. Usa só tokens `--vv-*` (nada de cinza escuro do padrão antigo).
2. Contraste conferido (4,5:1 texto, 3:1 ícone).
3. Tem fechar visível, fecha com Esc e cabe na tela (nada abre fora).
4. Conferida com dados reais, em 6 tamanhos de tela, sem nada cobrir nada.
5. Selecionado = fundo `--vv-acao` com texto branco.
