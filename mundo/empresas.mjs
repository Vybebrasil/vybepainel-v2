// Empresas de Irecê no mapa e base do CRM de prospecção do 1º andar (setor SDR).
// Fonte principal: assets/mundo/crm-irece.json, base pública de CNPJ cuja publicação
// foi autorizada pelo Paulo; o build publica esse arquivo com hash.
// Sem ela, vale a lista pública do OpenStreetMap (assets/mundo/empresas-irece.json).
import OSM from '../assets/mundo/empresas-irece.json' with { type: 'json' };
import { Obra } from './voxel.mjs';
import { MARCOS } from './marcos.mjs';

export let EMPRESAS = OSM.empresas.map((e) => ({ ...e, setor: '', cnae: legivelOsm(e.tipo), endereco: [e.rua, e.numero].filter(Boolean).join(', '), onde: 'rua' }));
export let FONTE_EMPRESAS = OSM.fonte;
export async function carregarEmpresas(url = '/assets/mundo/crm-irece.json') {
  try {
    const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!r.ok) return false;
    const d = await r.json();
    if (!Array.isArray(d.empresas) || !d.empresas.length) return false;
    EMPRESAS = d.empresas.filter((e) => e.x != null); FONTE_EMPRESAS = d.fonte; return true;
  } catch { return false; }
}
function legivelOsm(t) {
  const [g, s] = String(t || '').split(':');
  const M = { supermarket: 'Supermercado', restaurant: 'Restaurante', cafe: 'Café', bank: 'Banco', pharmacy: 'Farmácia', school: 'Escola', clothes: 'Roupas', bakery: 'Padaria',
    fuel: 'Posto', hospital: 'Hospital', clinic: 'Clínica', dentist: 'Dentista', hotel: 'Hotel', fast_food: 'Lanchonete', bar: 'Bar', car: 'Carros', hardware: 'Material de construção',
    beauty: 'Beleza', hairdresser: 'Cabeleireiro', mobile_phone: 'Celulares', electronics: 'Eletrônicos', furniture: 'Móveis', place_of_worship: 'Igreja', townhall: 'Prefeitura/Câmara',
    courthouse: 'Fórum', bus_station: 'Rodoviária', stadium: 'Estádio', park: 'Praça/Parque', pitch: 'Quadra', public_building: 'Prédio público', university: 'Faculdade', college: 'Faculdade' };
  return M[s] || ({ loja: 'Loja', servico: 'Serviço', lazer: 'Lazer', saude: 'Saúde', turismo: 'Turismo', escritorio: 'Escritório', oficio: 'Ofício', predio: 'Prédio' }[g] || 'Empresa');
}
export const TIPO_LEGIVEL = (e) => (typeof e === 'object' ? e.cnae || e.setor || 'Empresa' : legivelOsm(e));
const COR = { 'Comércio': '#FF7A2F', 'Serviços': '#0D74CE', 'Indústria': '#8E4EC6', 'Agropecuária': '#18A957', 'Construção': '#B07A45' };

// Uma plaquinha por empresa (poste + placa na cor do setor), tudo num só desenho; nome só das
// associadas da ACE, para o mapa não virar sopa de letras. O resto aparece no CRM e no foco.
let grupo = null, rotulos = [];
export function construirEmpresas(motor, irece, THREE) {
  if (grupo) { motor.cena.remove(grupo); grupo.traverse((o) => { o.geometry?.dispose?.(); }); }
  rotulos.forEach((r) => motor.removerRotulo(r)); rotulos = [];
  const o = new Obra();
  for (const e of EMPRESAS) {
    if (MARCOS.some((m) => Math.hypot(m.x - e.x, m.z - e.z) < m.r + 1.5)) continue;
    const virouPredio = irece.construidas?.has(e.cnpj || e.nome);
    if (virouPredio && !e.ace) continue; // a empresa já está no mapa como prédio no endereço
    const y = irece.alturaEm(e.x, e.z), cor = COR[e.setor] || (e.setor ? '#64738A' : '#FF7A2F');
    // Sem prédio no endereço exato, a empresa fica só no CRM (posição de bairro caía no meio da rua).
    if (!virouPredio) continue;
    if (e.ace) {
      o.luz(e.x, y + 1.35, e.z, .12, .12, .12, '#FFD166');
      rotulos.push(motor.rotulo({ pos: new THREE.Vector3(e.x, y + 1.7, e.z), classe: 'rotulo-empresa', html: String(e.nome).replace(/[<>&]/g, ''), distMax: 110, prioridade: -2 }));
    }
  }
  grupo = o.montar({ sombra: false }); motor.adicionar(grupo);
}
