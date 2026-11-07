# Chamadas do Irecity — correções locais de 07/11/2026

Implementação local sobre o conteúdo do PR #505. Sem commit, push, deploy, migração, reinício de serviço ou envio de WhatsApp.

## Comportamento corrigido

- Entrar numa sala, clicar na própria sala e tentar uma porta recusada preservam a escolha de mute e o diagnóstico do microfone.
- Foco, Praça e transição para outro canal desligam câmera e tela, além do áudio. Retorno tardio da permissão de mídia é conferido novamente; mute durante habilitação pendente de áudio é respeitado.
- O indicador de fala reutiliza o medidor de áudio existente. Microfone ligado não equivale a fala detectada.
- A barra só anuncia conexão quando o canal corresponde ao lugar atual. Conta participantes da chamada separadamente das pessoas presentes e não afirma que o som está sendo ouvido no aparelho remoto.
- Mostrar/parar tela tem botão direto na barra, usando o SDK já existente. TV do YouTube continua disponível.
- O palco mantém os streams sem duplicar vídeos, identifica a pessoa, oferece controles nativos, tela cheia e parar a própria transmissão. Sua posição considera a altura da barra de voz.
- Sair da chamada na barra do Irecity encerra os dispositivos e a reunião, preserva presença/lugar no painel e impede reconexão automática. A barra oferece entrar novamente; clicar numa sala também retoma, sem alterar mute.
- Entradas anteriores à saída são invalidadas durante token, carga do motor, inicialização e entrada na reunião. Temporizadores antigos não retomam a voz, e o fim de uma saída anterior não limpa os vídeos de uma chamada nova.
- Ajustar o processamento de áudio preserva a escolha de mute ao reconectar.

Fontes: `vybe-mundo.js`, `vybe-escritorio.js`, `vybe-mundo.css`.
Regressões: `tests/mundo-chamadas.test.mjs` e ajuste da expectativa antiga em `tests/mundo-escritorio-sem-desenho.test.mjs`.

## Verificação e limites

As regressões novas são SAFE: VM com funções reais, dispositivos, streams e DOM simulados; sem rede, banco ou captura real. Validação final: `npm run check` passou, incluindo sintaxe/escopo global, 1.223 testes (zero falhas, cancelados ou ignorados) e build local. `git diff --check` passou. Os 20 testes novos cobrem chamada, palco, saída manual, ajustes de áudio e cancelamento de entradas atrasadas; o teste anterior de entrada na sala foi atualizado para exigir preservação do mute. As seis regressões iniciais de saída/mute falharam antes da correção e passaram depois dela. Nenhum serviço operacional foi iniciado.

Não há validação visual no navegador nem chamada real entre duas pessoas nesta etapa. Antes de publicar/considerar operação validada, conferir em ambiente identificado:

1. Duas pessoas se ouvindo; uma terceira em outra sala não reproduzindo áudio ou vídeo delas.
2. Troca e tentativa de entrada recusada preservando mute; reconexão e transferência entre abas. Sair durante a conexão, aguardar sem reconectar e entrar novamente de propósito.
3. Câmera e tela desligadas no Foco e Praça, inclusive com permissão pendente.
4. Iniciar/parar tela, encerrar pelo seletor do navegador, recolher/ampliar palco e tela cheia.
5. Larguras de computador e celular sem sobreposição da barra.

O motor continua usando uma reunião compartilhada para salas abertas, com filtro de reprodução no navegador. Esta entrega não transforma esse filtro em isolamento de mídia no servidor e não modifica as permissões/trancas do Worker. Separar reuniões requer revisão própria de autenticação, convidados e reconexão.

Alterações anteriores em `vybe-escritorio-mapa.js` e `arquivo/` foram preservadas.
