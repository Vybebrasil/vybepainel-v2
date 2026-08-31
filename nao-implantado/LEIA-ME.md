# Escritos, nunca publicados

Estes dois arquivos foram escritos durante o corte de dependência do Monday, mas
**nunca chegaram a rodar em produção**. Confirmado consultando os endereços no ar:
`/api/diario` e `/api/diag-auth` respondem 404.

O motivo é o teto do plano: a Vercel no plano Hobby aceita **12 funções de
servidor**, e a pasta `api/` já tem exatamente 12. Estes dois seriam o 13º e o
14º.

Ficam guardados aqui, fora da pasta `api/`, por dois motivos:

- dentro de `api/` cada arquivo vira uma função, e a implantação inteira passaria
  a falhar por estourar o teto;
- solto na raiz, o arquivo seria servido como página e o código do servidor
  ficaria legível para qualquer pessoa na internet.

O `.vercelignore` mantém esta pasta fora do que sobe para a Vercel.

Para usar algum deles um dia: ou desligar outra função de `api/`, ou subir de
plano.

- `diario.js` — endpoint do Diário de bordo (consulta ao banco).
- `diag-auth.js` — endpoint de diagnóstico que informa se a chave do espelho
  está configurada.
