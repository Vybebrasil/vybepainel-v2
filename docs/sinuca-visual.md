# Sinuca de boteco — visual local, 28/10/2026

## Entrega

- `assets/jogos/boteco-ambiente.webp`: parede, azulejos e luz de boteco; 170.208 bytes.
- `assets/jogos/boteco-madeira.webp`: madeira para o cabeçalho e painéis; 71.218 bytes.
- Assets gerados com a ferramenta integrada `image_gen`, convertidos em WebP.
- A mesa enviada pelo Paulo foi preservada, assim como a física calibrada.
- Controles abaixo da mesa, barra horizontal, força exata em porcentagem,
  menu de ações e abas de partida, lousa/histórico e regras.
- Branca com sombra de contato e contorno adaptado à luminosidade do pano.

## Prompts finais usados

### Ambiente

Use case: photorealistic-natural. Asset type: background image for a Brazilian neighborhood pool bar game interface, NOT a screenshot or UI mockup. Generate a wide landscape 16:9 atmospheric interior wall of an authentic modest Brazilian boteco at night: weathered dark green plaster and glazed green ceramic tile wainscot, warm tungsten pool-room pendant light softly illuminating the upper corners, a small old wooden shelf with a few out-of-focus bottles toward the extreme right edge. The broad center and left remain empty dark textured wall for readable game interface laid over it. Palette deep forest green, aged walnut brown, muted brass and amber light. Cinematic realistic natural material detail, welcoming lived-in bar, restrained contrast, dark exposure, slightly dusty. Straight-on wall composition, no perspective pool table, no people, no text, no logos, no watermark, no user interface. This is an actual production background texture asset.

### Madeira

Use case: photorealistic-natural. Asset type: reusable material texture for a Brazilian pool bar game UI. Create a seamless tileable square flat texture of old dark walnut counter wood: horizontal long grain, subtle shallow scratches from years of use, very faint rings and warm brown-black patina, lightly waxed matte surface, natural realistic microdetail. Entire image is wood only, equal soft front lighting, no perspective, no vignette, no edge frame, no objects, no strong board seams, no text, no logos, no hardware, no watermark. Restrained dark contrast so cream and brass interface text laid on top stays readable. This will be tiled across panel headers and button surrounds.

## Verificação

- 31 regressões de física/regras/mesa e 2 testes dos menus: isolamento do tema
  ao trocar de jogo e preservação dos handlers de empate, desistência e saída.
- Navegador: abas, som, navegação, força 0,1/12,5/100%, arrasto horizontal,
  tacada até a animação terminar, contraste da branca sobre o logo, proporção
  da mesa e telas de 390/844 px sem transbordamento horizontal.
- Lobby e formulário de convite/aposta renderizados pelos módulos reais,
  com APIs bloqueadas; nenhuma chamada ou escrita de produção.
- Comparação da árvore CSS antes/depois, excluindo a sinuca: regras dos demais
  componentes preservadas. Sintaxe/escopo global e build conferidos.

## Limites

Validação inicial em ambiente local; publicação solicitada em 28/10/2026 e
acompanhada pelos checks do PR e por `HOMOLOGACAO.md`. A prévia joga pelos dois
lados; o teste visual de menus usa dados de teste isolados. Não confirma rede,
sessão nem economia de uma partida publicada.
