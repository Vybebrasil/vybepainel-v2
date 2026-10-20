import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// A fotinha da equipe no painel é a cabeça do personagem do Escritório; sem
// personagem, a foto de sempre. Trocar o visual troca o endereço da imagem
// (Paulo, 20/10/2026: "quando alguém mudar o personagem, gerar fotinha nova").
test('fotinha da equipe vira a cabeça do personagem e acompanha o visual', () => {
  const c = vm.createContext({ window: {}, document: {}, URLSearchParams });
  vm.runInContext(readFileSync('vybe-escritorio-mapa.js', 'utf8'), c);
  const dominio = readFileSync('vybe-dominio.js', 'utf8');
  const fonte = dominio.slice(dominio.indexOf('function aplicarFotosDoBanco'), dominio.indexOf('\n}\n', dominio.indexOf('function aplicarFotosDoBanco')) + 2);
  vm.runInContext(`var TEAM_USERS = [{id:'1',name:'Paulo',photo:null},{id:'2',name:'Jady',photo:null}];\n${fonte}`, c);
  vm.runInContext(`aplicarFotosDoBanco([{id:'1',foto_url:'https://drive/foto1',personagem:{figura:'hd-180-1.hr-828-61'}},{id:'2',foto_url:'https://drive/foto2'}])`, c);
  const [paulo, jady] = vm.runInContext('TEAM_USERS', c);
  const url = new URL(paulo.photo);
  assert.equal(url.searchParams.get('headonly'), '1');
  assert.equal(url.searchParams.get('figure'), 'hd-180-1.hr-828-61');
  assert.equal(paulo.fotoReal, 'https://drive/foto1', 'a foto de sempre fica guardada');
  assert.equal(jady.photo, 'https://drive/foto2', 'sem personagem, a foto de sempre');
  vm.runInContext(`aplicarFotosDoBanco([{id:'1',foto_url:'https://drive/foto1',personagem:{figura:'hd-600-1.hr-515-45'}}])`, c);
  assert.equal(new URL(vm.runInContext('TEAM_USERS[0].photo', c)).searchParams.get('figure'), 'hd-600-1.hr-515-45', 'visual novo, fotinha nova');
});
