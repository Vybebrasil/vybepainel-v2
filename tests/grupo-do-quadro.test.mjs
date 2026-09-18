// Cada quadro tem os seus grupos. O cadastro de Solicitações usava a regra de
// entrada de Produção e punha Impresso e Design no "Design & Edição" de Produção.
import test from 'node:test';
import assert from 'node:assert/strict';
import { exigirGrupoDoQuadro } from '../api/conteudo.js';

const PRODUCAO = 7829537690;
const DEMANDAS = 8385559107;

test('solicitação não entra em grupo de Produção', () => {
  assert.throws(() => exigirGrupoDoQuadro('novo_grupo__1', DEMANDAS), /Design & Edição" não pertence a este quadro/);
  assert.doesNotThrow(() => exigirGrupoDoQuadro('novo_grupo_mkmkjdqd', DEMANDAS));
});

test('conteúdo não entra em grupo de Solicitações', () => {
  assert.throws(() => exigirGrupoDoQuadro('novo_grupo_mkmkjdqd', PRODUCAO), /A Fazer" não pertence/);
  assert.doesNotThrow(() => exigirGrupoDoQuadro('novo_grupo__1', PRODUCAO));
  assert.throws(() => exigirGrupoDoQuadro('grupo_inventado', PRODUCAO), /não pertence/);
});
