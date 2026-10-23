# Vybe AI — conector interno em simulação

Fonte canônica nesta branch do PR #357. Substitui os dois arquivos auditados do Windows; não cria sistema paralelo nem altera dependências do Vybe OS. Node 24, whatsapp-web.js e qrcode-terminal existentes; SQLite nativo somente para metadados locais anti-replay. Preserve package.json/package-lock/node_modules e sessão do projeto Windows ao copiar os dois arquivos.

## Estado seguro

- SIMULACAO=true obrigatório; **não existe envio WhatsApp nesta versão**. Não há toggle de ambiente para habilitar respostas.
- VYBE_API_HABILITADA ausente/0 bloqueia todo processamento. Até a orientação geral exige funcionário elegível no OS; o bot deixa de ter acesso genérico apenas por participação em grupo.
- Produção e grupos de clientes não são destinos aceitos. O conector aceita o alias estável do Preview da branch e o deployment anterior desativado. Nunca usar token Production nesta entrega.
- Oito grupos originais preservados: Produção; Correção; Saída de Publicações; #VYBE - Criação; Atendimento & Planejamento; VYBE - Geral; Mídia Paga; Diretoria.

## Contrato com o servidor

O servidor recebe contexto fresco (30 segundos), JID da plataforma, grupos aprovados do remetente e audiência completa. IDs de grupos são aprovados em VYBE_GRUPOS_IDS no Windows e VYBE_AI_GRUPOS_IDS no servidor; nenhum nome ou resultado do modelo concede acesso. Para grupo, todos os participantes precisam de vínculo, conta ativa e liberação no piloto, inclusive a conta conectada se ela constar na audiência. Identidades LID/c.us não são convertidas por sufixo. Participante desconhecido/inválido/duplicado bloqueia a consulta.

O conector é um componente de confiança: o servidor não consulta o WhatsApp independentemente para comprovar a lista. Comprometer token/processo permite forjar declarações; proteger token, sessão e sistema operacional é obrigatório. Não há modo cliente habilitado.

## Configuração somente homologação (após autorização de teste)

No PowerShell do operador, sem transcrição de terminal:

```powershell
Set-Location C:\whatsapp-ia
$env:VYBE_API_URL = 'https://vybepainel-v2-git-feature-vybe-ai-readonly-integration-vybe-hub.vercel.app'
$env:VYBE_AI_BOT_TOKEN = (Get-Content -Raw 'C:\whatsapp-ia\token-vybe.txt').Trim()
$env:VYBE_API_HABILITADA = '1'
# Defina VYBE_GRUPOS_IDS somente com os IDs internos conferidos localmente.
$env:VYBE_TESTE_PROPRIO = '1'
$env:VYBE_PREVIA_LOCAL = '0'
node bot.js
```

O servidor permanece desligado e sem IDs configurados nesta entrega. Retorno 503 é esperado até aprovação para ativar homologação; o Windows não consegue ativá-lo por conta própria. Nunca enviar LINK_SECRET, segredo da ponte Hub ou credencial Meta/Google ao Windows.

Para levantar os oito grupos sem autorizar por nomes: VYBE_LISTAR_GRUPOS=1 escreve `.vybe-ai-local/grupos-encontrados.json` no evento ready. Revise IDs no WhatsApp, configure os aprovados e desative a listagem. O arquivo contém metadados privados, não deve ir ao Git. QR somente com VYBE_MOSTRAR_QR=1 em terminal privado.

## Uso

- `!vybe <pergunta livre>`: linguagem natural, consulta ferramentas do servidor quando necessário e fundamenta estratégia em fontes operacionais permitidas.
- `!vybe vincular <codigo>`: caminho determinístico, somente no privado, sem passar código ao modelo. Habilitar API pode escrever vínculo exclusivamente na homologação; simulação significa não enviar respostas, não significa impedir confirmação de vínculo.
- `!vybe minhas demandas`: atalho privado existente. No grupo, usa o fluxo natural e a identidade validada. Não é o limite do acesso operacional.
- Comando próprio só em conversa consigo mesmo e com teste explícito; comandos próprios em grupos/terceiros continuam bloqueados para evitar ciclos. Mensagens recebidas de colegas nos oito grupos são suportadas com audiência autorizada.

## Contexto e envio

Qwen3.5:35b-a3b no Ollama em loopback; até três ferramentas por pergunta, quatro rodadas, 16 KB acumulados de resultados, num_ctx 8192, num_predict 1024 e prazo total aproximado de 150 segundos mais eventuais validações em trânsito. Sem histórico entre mensagens/funcionários/grupos. Dados autorizados e instruções do usuário são entradas não confiáveis, não alteram ferramentas ou permissões. Não há SQL, URL arbitrária ou ações de escrita disponíveis ao modelo.

Revalida audiência e vínculo a cada ferramenta e antes de preparar resultado. Mudança de participantes descarta resposta. Fontes são anexadas pelos IDs devolvidos pelo servidor; fatos não consultados não devem ser tratados como comprovados. Prompt estratégico é orientação, não garantia de acerto; revisão humana continua necessária.

Terminal só mostra categorias fixas. A resposta não é enviada nem gravada por padrão. VYBE_PREVIA_LOCAL=1 permite ao operador vinculado conferir a própria resposta no arquivo privado `.vybe-ai-local/previa-local.txt`; isso pode conter dados operacionais autorizados, exige ACL, conteúdo fictício e limpeza posterior. Não salvar prompts, códigos, tokens ou logs de respostas. Proteger token-vybe.txt, `.wwebjs_auth`, `.wwebjs_cache` e estado com ACL Windows; mode/chmod não substitui ACL.

Ledger SQLite persiste somente hashes/estado/horários/cooldown, nunca conteúdo. Reserva é atômica e não é retomada automaticamente. Cooldown 10 s, até 20 trabalhos/minuto e dois trabalhos ativos. Uma instância por pasta, lock de execução; após queda só remover lock depois de confirmar que processo terminou. Não operar cópias independentes da mesma sessão. Não apagar ledger para repetir mensagem; envie um comando novo.

Preparação para envio futuro: retorno final autorizado, audiência estável e evento deduplicado estão definidos. Persistência de estados enviado/incerto, reconciliação com ID WhatsApp e nova auditoria ainda são obrigatórias antes de adicionar envio. Não existe garantia de exactly-once para mensagens externas. Esta versão deliberadamente não contém msg.reply/sendMessage.

## Testes

`node --test conector.test.js` não inicializa WhatsApp nem usa rede real. O CI do Vybe OS importa a mesma suíte. Testar depois no Node 24/Windows: IDs reais, participação completa, código privado, revogação, reconexão, duplicatas e ausência de logs/envios. Alterar o modelo ou atualizar dependências exige nova verificação, não está incluído nesta entrega.
