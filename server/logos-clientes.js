// O que falta no cadastro para todo cliente ativo ter a logo (Paulo, 16/11/2026: "deixa todos com sua logo... pega do
// insta ou do drive"; o ok para gravar o que faltar veio no mesmo dia). Só monta o plano: quem grava é
// scripts/logos-clientes.mjs, pelo mesmo salvarCadastro da ficha, e só com --gravar.
//
// Por cliente ativo:
//   instagram  cadastro vazio ou com um @ que não é @ (link quebrado, texto solto) e o cérebro do cliente
//              (vybe-clientes-cerebro.js) sabe o @ → grava o do cérebro. Os dois válidos e diferentes: NÃO grava,
//              fica "conferir" (só o Paulo sabe qual está certo).
//   logo_url   nenhuma logo guardada (identidade.logo, identidade.logo_drive nem cadastro.logo_url) e a busca no Drive
//              achou uma → grava o link do arquivo no Drive. Sem busca no Drive (sem acesso), não propõe nada.
import { usuarioDoInstagram } from './instagram-feed.js';

const norm = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// O mesmo encontro de nomes da tela (vybe-logo-cliente.js e o Feed): nome, apelido ou um começando pelo outro.
export function dossieDoCliente(nome, base = []) {
  const n = norm(nome);
  if (!n) return null;
  return base.find((d) => norm(d.nome) === n || (d.apelidos || []).some((a) => norm(a) === n))
    || base.find((d) => norm(d.nome).startsWith(n) || n.startsWith(norm(d.nome))) || null;
}

export const linkDoArquivoNoDrive = (id) => (/^[\w-]{10,80}$/.test(String(id || '')) ? `https://drive.google.com/file/d/${id}/view` : '');

// clientes: [{ id, nome, ativo, cadastro: { instagram, logo_url }, logo, logo_drive }]
// logosNoDrive: Map(id do cliente → { id, nome }) com o melhor arquivo que a busca achou (opcional).
export function planejarLogos(clientes, { cerebro = [], logosNoDrive = new Map() } = {}) {
  const mudar = [], conferir = [], sem = [], prontos = [];
  for (const c of clientes || []) {
    if (c.ativo === false) continue;
    const nome = String(c.nome || '').trim();
    const cad = c.cadastro || {};
    const igHoje = String(cad.instagram || '').trim();
    const igValido = usuarioDoInstagram(igHoje);
    const igCerebro = usuarioDoInstagram(dossieDoCliente(nome, cerebro)?.instagram || '');
    let ig = igValido;
    if (!igValido && igCerebro) {
      mudar.push({ cliente_id: c.id, cliente: nome, campo: 'instagram', hoje: igHoje, novo: '@' + igCerebro,
        motivo: igHoje ? 'o @ do cadastro não é um @ do Instagram; o cérebro do cliente tem este' : 'cadastro sem @; o cérebro do cliente tem este' });
      ig = igCerebro;
    } else if (igValido && igCerebro && igValido !== igCerebro) {
      conferir.push({ cliente_id: c.id, cliente: nome, campo: 'instagram', hoje: igHoje, cerebro: '@' + igCerebro,
        motivo: 'cadastro e cérebro com @ diferentes: confirmar qual é o certo (não gravo)' });
    }
    const logoHoje = String(cad.logo_url || '').trim();
    const temLogo = Boolean(logoHoje || c.logo || c.logo_drive);
    const achado = logosNoDrive.get(String(c.id));
    if (!temLogo && achado?.id) {
      mudar.push({ cliente_id: c.id, cliente: nome, campo: 'logo_url', hoje: '', novo: linkDoArquivoNoDrive(achado.id), motivo: `logo achada no Drive: ${achado.nome || achado.id}` });
    }
    const fontes = [temLogo && 'logo do cadastro', ig && `Instagram @${ig}`, !temLogo && achado?.id && 'logo do Drive'].filter(Boolean);
    (fontes.length ? prontos : sem).push({ cliente_id: c.id, cliente: nome, fontes });
  }
  return { mudar, conferir, prontos, sem };
}
