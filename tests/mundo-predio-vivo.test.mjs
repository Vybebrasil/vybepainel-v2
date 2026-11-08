// Prédio vivo e roteiro das captações (Paulo, 07/11/2026): a saúde de cada andar na escala de
// urgência e a sugestão de juntar as captações da semana por dia e bairro. Funções puras.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { saudeDosAndares, lerModulo, URGENCIA, ANDARES_COM_SAUDE } from '../mundo/saude-andares.mjs';
import { roteirosDaSemana, bairroDoEndereco, ordemPorVizinho, nomeDoDia } from '../mundo/captacoes.mjs';
import { PLANTA } from '../mundo/planta.mjs';

const HOJE = '2026-11-10';
const peca = (id, extra) => ({ id, status: 'Em andamento', ...extra });

test('saúde: os andares com regra existem na planta e as cores seguem a escala do padrão visual', () => {
  for (const id of ANDARES_COM_SAUDE) assert.ok(PLANTA.some((a) => a.id === id), id);
  assert.equal(URGENCIA[1].cor, '#D93D42');
  assert.equal(URGENCIA[6].cor, '#18A957');
});

test('saúde da Criação: verde sem atraso, âmbar com atraso, vermelho com mais de 5', () => {
  const emDia = saudeDosAndares({ itens: [peca(1, { prazo_iso: '2026-11-12' })], hoje: HOJE });
  assert.equal(emDia.criacao.nivel, 6);
  const duas = saudeDosAndares({ itens: [peca(1, { prazo_iso: '2026-11-08' }), peca(2, { veiculacao_iso: '2026-11-09' }), peca(3)], hoje: HOJE });
  assert.equal(duas.criacao.nivel, 2);
  assert.equal(duas.criacao.motivo, '2 demandas atrasadas.');
  const seis = saudeDosAndares({ itens: Array.from({ length: 6 }, (_, i) => peca(i, { prazo_atrasado: true })), hoje: HOJE });
  assert.equal(seis.criacao.nivel, 1);
  assert.match(seis.criacao.motivo, /6 demandas atrasadas/);
  // Repetida (DADOS_ALL + DADOS_DEMANDAS) conta uma vez; concluída não conta.
  const cinco = saudeDosAndares({ itens: [...Array.from({ length: 5 }, (_, i) => peca(i, { prazo_atrasado: true })), peca(0, { prazo_atrasado: true }), peca(9, { status: 'Finalizado', prazo_atrasado: true })], hoje: HOJE });
  assert.equal(cinco.criacao.nivel, 2);
});

test('saúde da Criação usa a situação do painel quando ela é passada', () => {
  const r = saudeDosAndares({ itens: [peca(1), peca(2)], hoje: HOJE, situacao: (i) => (i.id === 1 ? 'atrasada' : 'concluida') });
  assert.equal(r.criacao.nivel, 2);
  assert.equal(r.criacao.motivo, '1 demanda atrasada.');
});

test('saúde do Atendimento: peças paradas em aprovação há mais de 3 / 7 dias', () => {
  const nova = peca(1, { status: 'Para Aprovação', status_updated_at: '2026-11-08T10:00:00Z' });
  const quatro = peca(2, { status: 'Ag. aprovação cliente', status_updated_at: '2026-11-06T10:00:00Z' });
  const oito = peca(3, { status: 'Em aprovação', status_updated_at: '2026-11-02T09:00:00Z' });
  const aprovado = peca(4, { status: 'Aprovado', status_updated_at: '2026-10-01T09:00:00Z' });
  assert.equal(saudeDosAndares({ itens: [nova, aprovado], hoje: HOJE }).comercial.nivel, 6);
  const amb = saudeDosAndares({ itens: [nova, quatro], hoje: HOJE }).comercial;
  assert.equal(amb.nivel, 2);
  assert.equal(amb.motivo, '1 peça parada em aprovação há mais de 3 dias.');
  const verm = saudeDosAndares({ itens: [nova, quatro, oito], hoje: HOJE }).comercial;
  assert.equal(verm.nivel, 1);
  assert.equal(verm.motivo, '1 peça parada em aprovação há mais de 7 dias.');
  const semData = saudeDosAndares({ itens: [peca(5, { status: 'Para aprovação', status_updated_at: '' })], hoje: HOJE }).comercial;
  assert.equal(semData.nivel, 5);
  assert.equal(semData.motivo, '1 peça em aprovação sem a data em que entrou.');
});

test('saúde do Comercial e do Financeiro: módulos que ainda não existem ficam neutros', () => {
  const r = saudeDosAndares({ itens: [peca(1)], hoje: HOJE });
  assert.equal(r.financeiro.nivel, 5);
  assert.match(r.financeiro.motivo, /Sem leitura do Financeiro/);
  assert.equal(r.comercial.nivel, 6, 'sem VybeComercial vale só o Atendimento');
  const com = saudeDosAndares({ itens: [peca(1)], hoje: HOJE, comercial: { nivel: 2, motivo: '3 propostas sem retorno há uma semana.' }, carteira: { vencidos: [{}, {}] } });
  assert.equal(com.comercial.nivel, 2);
  assert.equal(com.comercial.motivo, '3 propostas sem retorno há uma semana.');
  assert.equal(com.financeiro.nivel, 2);
  assert.equal(com.financeiro.motivo, '2 cobranças vencidas no Financeiro.');
  assert.equal(lerModulo({ inadimplentes: 7 }, 'Financeiro').nivel, 1);
  assert.equal(lerModulo({ vencidos: 0 }, 'Financeiro').nivel, 6);
  assert.equal(lerModulo({ saude: { nivel: 4, motivo: 'Esperando o banco.' } }, 'Financeiro').motivo, 'Esperando o banco.');
});

test('saúde: agente que falhou acende o andar de vermelho; sem peças, neutro', () => {
  const r = saudeDosAndares({ itens: [peca(1)], hoje: HOJE, agentes: { criacao: ['disponivel', 'falhou'] } });
  assert.equal(r.criacao.nivel, 1);
  const vazio = saudeDosAndares({ itens: [], hoje: HOJE });
  assert.equal(vazio.criacao.nivel, 5);
  assert.equal(vazio.comercial.nivel, 5);
});

test('roteiro: bairro sai do endereço só quando há rua e um trecho de bairro', () => {
  assert.equal(bairroDoEndereco('R. Lafaiete Coutinho, 217 - Alto do Moura'), 'Alto do Moura');
  assert.equal(bairroDoEndereco('Rua Aurélio José Marques, 66 - 1º andar - Centro'), 'Centro');
  assert.equal(bairroDoEndereco('Antonov Center - Av. Primeiro de Janeiro, 422'), '');
  assert.equal(bairroDoEndereco('Serra Grande Bebidas LTDA - Nova Schin'), '');
  assert.equal(bairroDoEndereco('Fora de Irecê'), '');
  assert.equal(nomeDoDia('2026-11-10'), 'Terça');
});

test('roteiro: vizinho mais próximo a partir da Vybe', () => {
  const o = ordemPorVizinho({ x: 0, z: 0 }, [{ id: 'longe', x: 50, z: 0 }, { id: 'perto', x: 5, z: 0 }, { id: 'meio', x: 20, z: 0 }]);
  assert.deepEqual(o.map((p) => p.id), ['perto', 'meio', 'longe']);
});

test('roteiro da semana: agrupa por dia e bairro, sugere a ordem e não mexe na agenda', () => {
  const pontos = {
    Hellen: { x: 100, z: 0, bairro: 'Centro' },
    Experimente: { x: 110, z: 10, bairro: 'Centro' },
    Brussolo: { x: -200, z: 0, bairro: 'Lagoa do Tio' },
    DiaCenter: { x: 60, z: 60, bairro: 'Recanto das Árvores' },
  };
  const eventos = [
    { dia: '2026-11-10', tipo: 'captacao', cliente: 'Hellen', inicio: '08:00' },
    { dia: '2026-11-10', tipo: 'captacao', cliente: 'Brussolo', inicio: '10:00' },
    { dia: '2026-11-10', tipo: 'captacao', cliente: 'Experimente', inicio: '14:00' },
    { dia: '2026-11-10', tipo: 'reuniao', cliente: 'Hellen', inicio: '16:00' },
    { dia: '2026-11-12', tipo: 'captacao', cliente: 'DiaCenter', inicio: '09:00' },
    { dia: '2026-11-13', tipo: 'captacao', cliente: 'Hellen', inicio: '09:00' },
    { dia: '2026-11-13', tipo: 'captacao', cliente: 'Cliente Novo', inicio: '11:00', local: 'Rua Nova, 10 - Boa Vista' },
    { dia: '2026-11-09', tipo: 'captacao', cliente: 'Hellen' },
    { dia: '2026-11-09', tipo: 'captacao', cliente: 'Experimente' },
  ];
  const copia = JSON.parse(JSON.stringify(eventos));
  const r = roteirosDaSemana(eventos, { pontoDe: (c) => pontos[c] || null, origem: { x: 0, z: 0 }, desde: HOJE });
  assert.deepEqual(eventos, copia, 'só sugere; a agenda fica igual');
  assert.deepEqual(r.dias.map((d) => d.dia), ['2026-11-10', '2026-11-13'], 'dia com uma captação só não vira roteiro; ontem fica de fora');
  const terca = r.dias[0];
  assert.equal(terca.frase, 'Terça: 3 captações no Centro e na Lagoa do Tio — junte num roteiro');
  assert.deepEqual(terca.ordem.map((p) => p.cliente), ['Hellen', 'Experimente', 'Brussolo']);
  assert.ok(terca.economia > 0, 'pela hora da agenda (vai, cruza a cidade e volta) anda mais');
  assert.ok(terca.km > 0);
  const sexta = r.dias[1];
  assert.equal(sexta.frase, 'Sexta: 2 captações no Centro e na Boa Vista — junte num roteiro');
  assert.deepEqual(sexta.ordem.map((p) => [p.cliente, p.noMapa]), [['Hellen', true], ['Cliente Novo', false]]);
  assert.equal(sexta.semMapa, 1);
  assert.deepEqual(r.juntar.map((j) => j.frase), ['Centro tem captação na terça e na sexta: dá para juntar num dia só?']);
});

test('prédio vivo ligado: faixa do andar com alvo, mundo expõe as funções e o HUD usa', () => {
  const predio = fs.readFileSync('mundo/predio.mjs', 'utf8');
  assert.match(predio, /faixa\.userData\.alvo = \{ tipo: 'andar'/);
  const m3d = fs.readFileSync('mundo/mundo-3d.mjs', 'utf8');
  assert.match(m3d, /saudeDosAndares/);
  assert.match(m3d, /roteirosDaSemana/);
  const hud = fs.readFileSync('vybe-mundo.js', 'utf8');
  assert.match(hud, /VybeComercial\?\.dados\?\.\(\)/);
  assert.match(hud, /VybeCarteira\?\.dados\?\.\(\)/);
  assert.match(hud, /vv-roteiros/);
});
