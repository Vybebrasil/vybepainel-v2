# Auditoria da sinuca — 28/10/2026

Base analisada: 2ee066c291c7065006392b500f6e3b594458ae2f, integrada pela PR 434. Mudanças seguintes estão na branch codex/sinuca-lobby-controles-jogo, ainda locais.

## Atualização — física corrigida em 29/10/2026

Os achados numéricos abaixo descrevem a versão anterior. Nesta atualização:

- O integrador limita o avanço ao instante de contato previsto entre esferas e cápsulas das borrachas, incluindo as pontas das quinas. Contatos que já começam encostados são resolvidos antes de avançar um passo inteiro.
- Contatos encadeados são resolvidos em até 12 iterações; a ordem usa posições físicas, sem depender dos números. No cenário de quatro bolas encostadas, inverter a numeração preserva o resultado dentro de 1e-7 unidade.
- Corte fino medido: 71,2274991005 graus no passo padrão e 71,2274974670 no refinado (1/9600 s), diferença de 0,000001634 graus; sem sobreposição residual nesse caso. Esta é evidência de convergência numérica, não uma comparação experimental com mesa real.
- Eixos usam uma métrica física única internamente. O formato público 100 x 50, a arte e as partidas salvas permanecem compatíveis; mira, colocação da branca, D, triângulo e bots usam a mesma escala.
- Curva de força tem valor e derivada contínuos na transição de 5%, mantendo 0,1% a 100% e máximo de 7 m/s. Efeito fica dentro do disco de alcance do taco e divide a energia entre translação e rotação.
- Testes de seguir, puxar e efeito lateral comparam a mesma velocidade física, compensando a energia rotacional. O teste de ausência de desvio respeita a quantização dos quadros (1e-6 unidade).
- As seis caçapas continuam permitindo parar na beirada sem atração; os doze dentes rebatem. As trajetórias mantêm pontos de contato e precisão compacta para a animação.
- Números usam a terceira coluna da matriz, assim como o disco branco. Centro da projeção e limites reais da tinta são usados; o número é recortado no disco e desaparece junto com ele na rotação rápida.
- O teste de dificuldade dos bots usa oportunidades idênticas e sequência aleatória repetível, evitando comparar sorte de saídas diferentes. A mira fantasma e a avaliação de caçapas dos bots foram adaptadas à métrica.

Verificação dirigida: testes de física, regras, caçapas, trilhas, números, controles, menus e cenário comparável dos bots aprovados. Captura visual das inscrições em 15 posições conferida; navegação desktop, celular e paisagem aprovada. Validação geral final: 389 arquivos com sintaxe válida, 996 testes aprovados, zero falhas e build concluído; git diff --check aprovado. O log integral está salvo na pasta local de artefatos da tarefa.

Limite de realismo: resistência do pano, restituição, salto, forro e perda de apoio continuam modelos aproximados; não houve calibração experimental em uma mesa instrumentada. Não há garantia de que todo cenário físico possível esteja coberto. Esta atualização segue local, sem publicação ou escrita em produção.
## Diagnóstico da versão anterior

A direção podia mudar no caminho até a força. Um tremor de 1 pixel disparou uma tacada a 0,2%. Cancelar o ponteiro deixava carga pendente. Corrigidos com mira deliberada, margem de 4 pixels, captura da direção e identificação do ponteiro e rodada. Clique na força seleciona; arrasto deliberado dispara; TACAR usa a porcentagem escolhida.

O motor ainda exige evolução para ser tratado como simulador rigoroso:

- Corte fino a 100%: ângulo do objeto 78,8835 graus a 600 Hz e 71,4440 a 9600 Hz. A referência refinada evidencia sensibilidade ao passo; não representa medição de uma mesa real. Prioridade: resolver instante de contato, depois impulso, sem esperar sobreposição.
- Saída: penetração máxima de 0,9081 cm; sobreposição residual intermediária de 0,3081 cm. Prioridade: contatos simultâneos com resolução iterativa e critérios de convergência.
- Trocar apenas números das bolas alterou o resultado até 1,7528 cm. O laço de pares depende da ordem.
- Escalas de desenho: 12,32 e 12,66 pixels por unidade, diferença de 2,7597%. Prioridade: uma única métrica para desenho, mira e física, recalibrando a geometria sem deformar a arte.
- Curva de força: derivada muda cerca de 10,77 vezes em 5%. A 1%, deslocamento livre medido de apenas 0,665 mm; a 5%, 1,696 cm. Uma curva monotônica não garante controle confortável. Calibrar por velocidade e distância, com transição suave.
- Efeito é acrescentado sem reduzir velocidade translacional: energia inicial até 2,25 vezes maior nos extremos combinados aceitos pelo servidor. Revisar modelo de impulso do taco e limite circular de efeito no servidor.
- Conservação de momento nos choques horizontais ficou dentro do erro numérico; não houve aumento de energia nos 36 casos de pano/tabela examinados. Não há evidência para trocar coeficientes arbitrariamente.

## Áudio e interface implementados

O som de bola anterior era impactPlate_light_000, impacto metálico genérico. Agora há gravações específicas de taco, bolas, borracha e caçapa, em OGG e MP3, com créditos visíveis em Como jogar. Eventos fracos são preservados, contatos diferentes no mesmo quadro não são descartados e o volume depende da intensidade. Pré-carregamento, retomada por gesto e limitador para contatos simultâneos. A seleção usa prévias públicas de 96 kbps; originais de maior qualidade exigem acesso adicional. Recortes e licenças em assets/jogos/sons/sinuca-fontes.json. A escuta humana final ainda é necessária para aprovar timbre e mixagem.

Lobby, desafios contra a casa, escolha do rival, aposta, convite e resultado receberam apresentação própria. Cinco assets gerados para a Vybe; prompts em sinuca-assets-prompts.json. Convites, inventários, prêmios e regras continuam nos handlers existentes. Os dados das capturas de menus são fictícios e exclusivos da prévia local.

## Evidências e limites

29 testes focados passaram após áudio/controles. Navegação em navegador real headless passou: mira estável, clique sem disparo, seleção de rival, aposta e convite; desktop, celular e paisagem sem overflow, sem erros JS. Validação final: npm run check passou, com sintaxe de 387 arquivos, 990 testes aprovados e build concluído. git diff --check também passou. Não houve publicação desta nova versão, nem alteração de dados de produção. Caçapas ainda usam regiões aproximadas de perda de apoio; validar bordas e bolas penduradas após corrigir o contato contínuo.

## Referências para próxima etapa

- https://drdavepoolinfo.com/FAQ/physics/physical-properties/
- https://drdavepoolinfo.com/technical_proofs/new/TP_A-30.pdf
- https://drdavepoolinfo.com/physics_articles/Mathavan_IMechE_2010.pdf
- https://ekiefl.github.io/2020/04/24/pooltool-theory/

Próxima etapa recomendada: solver com instante de colisão e contatos simultâneos, testes de convergência e independência dos números das bolas, depois calibração de força/efeito e homologação de áudio em equipamentos reais.

