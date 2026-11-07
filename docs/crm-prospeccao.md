# CRM de prospecção do 1º andar

Entrega em PR separado, sem merge/deploy autorizado nesta etapa.

## Aplicação manual

O Paulo revisa e executa `migrations/2026-11-07-crm-prospeccao.sql` no SQL Editor do Neon do ambiente escolhido. O SQL cria somente as tabelas de oportunidades e histórico e seus índices; não altera empresas/clientes nem envia mensagens. A API e o build não executam a migração. A migração foi testada em PostgreSQL WASM (PGlite), em memória; não foi aplicada em produção.

Sem as tabelas, o CRM retorna 503 e a tela informa a migração pendente. Os demais módulos continuam no fluxo existente. Após aplicação e aprovação do PR, conferir a abertura pelo agente SDR do 1º andar.

## Fluxo

Empresa → Qualificação → Abordagem proposta → Aprovada → Contato feito → Reunião → Proposta comercial → Ganho. Perdido pode encerrar qualquer etapa aberta. Não há reabertura automática ou salto que dispense a aprovação humana. `Propor abordagem` abre diretamente uma proposta para a pessoa aprovar; `Adicionar ao funil` começa em Empresa. Registrar contato é uma declaração da equipe: não dispara comunicação.

GET `/api/painel?area=crm` entrega oportunidades paginadas (100), contagens por etapa, pessoas e a permissão de edição. `&id=ID` abre ficha/histórico (50 por página). POST aceita `criar`, `mover`, `comentar`, `atualizar` (responsável/próxima ação/data) e `importar` (até 100 propostas antigas). Não aceita credencial de serviço. Toda a equipe autenticada lê. A autorização de escrita é conferida no servidor, sem confiar no corpo do pedido. Comercial usa a função existente `atendimento` de `vybe_escritorio_funcoes`, além de administradores: as salas de Vinícius e Ewerton ficam no andar Comercial em `mundo/planta.mjs`, e o cadastro de funções os identifica como Atendimento. Não foram criados papéis nem concedidos acessos em produção.

O histórico guarda o autor autenticado e seu nome, horário, etapa anterior/nova, comentário e alterações de responsável/ação. Criação, importação e movimento são transacionais com o histórico. O bloqueio da linha e a etapa esperada evitam mover sobre uma mudança concorrente; a edição usa versão. CNPJ normalizado é único; sem CNPJ, a chave usa o nome sem acento, caixa ou espaços duplicados. Datas da próxima ação são datas de calendário sem conversão de fuso. Auditoria exibe America/Bahia.

## Importação do navegador

Na primeira abertura com permissão de edição e banco disponível, o CRM lê `vybe.crm.propostas` e envia lotes de até 100 ao servidor. Um marcador por conta e conteúdo só é salvo após todos os lotes serem confirmados. A chave única no banco evita duplicação mesmo após interrupção, outro dispositivo ou falha no marcador. O conteúdo original fica em `legado`; o autor do evento de importação é quem está autenticado. Campos antigos `setorEmpresa` e `setor` são aceitos; `setor: sdr` não vira segmento da empresa. A cópia antiga no navegador é preservada. Conta sem permissão não importa; dado inválido ou erro de banco não é tratado como sucesso.

## Verificação

`tests/crm.test.mjs`: rota sem sessão 401, credencial de serviço e escrita sem permissão 403, leitura, etapas/aprovação, histórico, responsável/data, versão concorrente, importação repetida, rollback quando histórico falha e 503 sem migração.

`tests/mundo-crm.test.mjs`: marcador de importação apenas após sucesso, repetição, preservação do original, falha de banco e conta sem permissão.
