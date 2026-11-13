// Padrão v2 · celular (quadro "No celular"): a gaveta da peça vira folha abaixo de 600 px e o CSS do grupo segue as regras.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ler = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const gaveta = ler('vybe-gaveta.js');
const css = ler('padrao-v2/celular.css');

function folhaNoVm({ item, opcoes = [], detail = {}, hoje = '2026-11-13' }) {
  const c = vm.createContext({
    safeText: (s) => String(s ?? '').replace(/[&<>"']/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x])),
    HOJE_ISO: hoje, cliCor: (n) => `<span class="cliente-carteira">${n}</span>`,
    operationalStatusOptions: () => opcoes, podeVerMonday: () => false,
    findOperationalItem: () => item, showToast: () => {}, document: undefined, window: undefined,
  });
  const ini = gaveta.indexOf('const GAVETA_ICONE');
  vm.runInContext(gaveta.slice(gaveta.indexOf('function menuDeAcoesDaPecaHtml'), gaveta.indexOf('function fecharMenusDaGaveta')), c);
  vm.runInContext(gaveta.slice(ini, gaveta.indexOf('const GAVETA_ABAS')).replace('const GAVETA_ICONE', 'globalThis.GAVETA_ICONE'), c);
  vm.runInContext('globalThis.ICONE_LINHA = { mais: "…" };', c);
  vm.runInContext(gaveta.slice(gaveta.indexOf('function proximoStatusDaPeca'), gaveta.indexOf('function gavetaObjetivoHtml')), c);
  vm.runInContext(gaveta.slice(gaveta.indexOf('// A GAVETA NO CELULAR'), gaveta.indexOf('function gavetaLinkHtml')).replace('const GAVETA_ETAPAS', 'globalThis.GAVETA_ETAPAS'), c);
  c.html = c.gavetaCelularHtml(detail, item, detail.assets || []);
  return c;
}

const OPCOES = ['Em andamento', 'Para aprovação', 'Alteração', 'Para agendar', 'Finalizado'].map((label) => ({ label }));

test('folha: etapas em texto com a atual em negrito, barra e lista na mesma ordem', () => {
  const c = folhaNoVm({ item: { id: '7', nome: 'Card · Promoção', cliente: 'Cliente A', status: 'Para aprovação', veiculacao: '14/11', prazo_iso: '2026-11-11' }, opcoes: OPCOES });
  assert.match(c.html, /Criação, <b>aprovação interna<\/b>, cliente, pronta/);
  assert.match(c.html, /class="v2-barra" style="--v:50%/);
  assert.match(c.html, /<span class="gv2-cel-pill r">Atrasada 2 dias<\/span>/);
  assert.match(c.html, /veicula 14\/11/);
  assert.equal((c.html.match(/class="gv2-cel-lin"/g) || []).length, 4, 'uma linha por etapa quando a peça não tem subdemandas');
  assert.match(c.html, /gv2-cel-cx ok[\s\S]*gv2-cel-cx vivo[\s\S]*gv2-cel-cx vazio/);
  assert.equal(c.etapaDaPeca({ status: 'Ag. Aprovação Cliente' }), 2);
  assert.equal(c.etapaDaPeca({ status: 'Para agendar' }), 3);
  assert.equal(c.etapaDaPeca({ status: 'Em andamento' }), 0);
});

test('folha: Pedir alteração e Aprovar só na aprovação interna e pelos portões de sempre', () => {
  const emAprovacao = folhaNoVm({ item: { id: '7', nome: 'x', status: 'Para aprovação' }, opcoes: OPCOES });
  assert.match(emAprovacao.html, /onclick="gavetaDecidir\('7','alterar'\)">Pedir alteração<\/button><button type="button" class="gv2-cel-btn k principal" onclick="gavetaDecidir\('7','aprovar'\)">Aprovar<\/button>/);
  const andando = folhaNoVm({ item: { id: '8', nome: 'y', status: 'Em andamento' }, opcoes: OPCOES });
  assert.doesNotMatch(andando.html, /Pedir alteração/);
  assert.match(andando.html, /gavetaAvancar\('8',this\)/);
  const cliente = folhaNoVm({ item: { id: '9', nome: 'z', status: 'Ag. aprovação cliente' }, opcoes: OPCOES });
  assert.doesNotMatch(cliente.html, /gavetaDecidir/, 'a aprovação do cliente não se decide na agência');
  const semAgendar = folhaNoVm({ item: { id: '6', nome: 'w', status: 'Para aprovação' }, opcoes: ['Em andamento', 'Para aprovação', 'Agendado', 'Alteração'].map((label) => ({ label })) });
  assert.equal(semAgendar.gavetaDecisaoDaPeca({ status: 'Para aprovação' }).aprovar.label, 'Agendado', 'sem "Para agendar", aprova para o status seguinte');
  assert.match(gaveta, /const portao = acao === 'aprovar' \? globalThis\.openQualityGate : globalThis\.openStatusContextGate;/);
});

test('folha: prévia da arte quando há imagem; sem imagem, o vazio leva ao envio', () => {
  const com = folhaNoVm({ item: { id: '1', nome: 'a', status: 'Para aprovação' }, detail: { assets: [{ name: 'arte.png', public_url: 'https://x/arte.png' }] } });
  assert.match(com.html, /<img src="https:\/\/x\/arte\.png" alt="Prévia da arte de a"/);
  const sem = folhaNoVm({ item: { id: '1', nome: 'a', status: 'Para aprovação' } });
  assert.match(sem.html, /gv2-cel-arte vazia" role="button" tabindex="0" onclick="document\.getElementById\('workspace-file-input'\)\.click\(\)"/);
  assert.match(sem.html, /ver a peça inteira/, 'o resto da peça fica a um toque');
});

test('folha: a gaveta nasce como folha e a peça inteira continua montada junto', () => {
  assert.match(gaveta, /drawer\.classList\.add\('gv2-folha'\);/);
  assert.match(gaveta, /<div class="gv2 gv2-tem-cel">\s*\$\{gavetaPegaHtml\(\)\}\$\{gavetaCelularHtml\(detail, item, assets\)\}/);
  assert.match(gaveta, /drawer\.className = 'gv2-gaveta gv2-folha gv2-folha-inteira';/, 'a solicitação abre esticada');
  assert.match(gaveta, /if \(dy > 70\) closeItemWorkspace\(\);/, 'arrastar o puxador para baixo fecha');
});

test('celular.css: tudo de celular dentro de 600 px, toque de 44 px e nada proibido', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html\s+body\.mundo/);
  assert.match(css, /@media \(max-width:600px\)\{/);
  assert.match(css, /\.gv2-pega\{[^}]*height:44px/);
  assert.match(css, /\.gv2-cel-btn\{[^}]*height:44px/);
  assert.match(css, /\.gv2-folha:not\(\.gv2-folha-inteira\)\{[^}]*bottom:0[^}]*border-radius:28px 28px 0 0/);
  assert.match(css, /body\.mundo #workspace-drawer\.gv2-gaveta \.gv2 > :is\(\.gv2-cel,\.gv2-pega\)\{display:none\}/, 'fora do celular a folha não aparece');
});
