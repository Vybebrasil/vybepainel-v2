import test from 'node:test';
import assert from 'node:assert/strict';
import { mondayQuery } from '../operational_mirror_store.js';
import { enviarParteNoDrive, enviarParaDrive } from '../vybe_drive.js';

test('homologação bloqueia Monday e Drive antes de qualquer chamada externa', async () => {
  const anterior = process.env.VYBE_HOMOLOGACAO;
  const originalFetch = globalThis.fetch;
  let chamadas = 0;
  process.env.VYBE_HOMOLOGACAO = '1';
  globalThis.fetch = async () => { chamadas++; throw new Error('Rede não deveria ser acessada'); };
  try {
    for (const chamada of [() => mondayQuery('mutation { teste }'),
      () => enviarParteNoDrive({sessao:'https://example.test',conteudo:'',inicio:0,total:0}),
      () => enviarParaDrive({url:'https://example.test'})]) {
      await assert.rejects(chamada, /desativadas neste ambiente/);
    }
    assert.equal(chamadas, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (anterior === undefined) delete process.env.VYBE_HOMOLOGACAO;
    else process.env.VYBE_HOMOLOGACAO = anterior;
  }
});
