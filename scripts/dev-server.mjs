import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoApi } from './fixtures.mjs';
import { lerCerebroDaCentral, lerAgentesDaCentral } from '../server/vybes.js';
import { ETAPAS_LEITURA, lerEtapa } from '../server/vybes-agentes.js';
import { paginaD3Html } from '../server/pagina-d3.js';
import { baldearCss } from './css-baldes.mjs';

const PROJECT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ROOT = process.env.VYBE_DEV_BUILD === '1' || process.argv.includes('--build') ? resolve(PROJECT, 'dist') : PROJECT;
const upstream = process.env.VYBE_DEV_UPSTREAM;
const allowWrites = process.env.VYBE_DEV_ALLOW_WRITES === '1';
const TYPES = { '.html':'text/html; charset=utf-8', '.json':'application/json; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.webp':'image/webp', '.ogg':'audio/ogg', '.webmanifest':'application/manifest+json', '.mp4':'video/mp4', '.mp3':'audio/mpeg', '.json':'application/json; charset=utf-8' };

// O DIAGNOSTICO DE AUTOMACAO CHEGA POR POST E NAO ESCREVE NADA.
//
// Ele le a peca, le as regras e explica por que nenhuma pegou. Sem esta excecao,
// conferir "por que nao rodou?" antes do deploy exigiria liberar as escritas
// inteiras contra o banco de producao — o que e o oposto do que este servidor e.
// Fica como funcao exportada, e nao como condicao solta no meio do fluxo, porque
// e uma excecao a uma trava: ela precisa ser estreita e precisa ser testavel.
export function ehLeituraPorPost(url) {
  return url.pathname === '/api/painel'
    && url.searchParams.get('area') === 'automacoes'
    && url.searchParams.get('acao') === 'simular';
}

// Endereço que não existe: página simples da Direção 3, em UTF-8 (sem o cabeçalho o navegador lia o "ã" quebrado).
function naoEncontrado(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(paginaD3Html({ titulo: 'Não encontrado.', rotulo: '404', texto: 'Este endereço não existe no Vybe OS.', acao: { texto: 'Abrir o Vybe OS', href: '/' } }));
}

let pacoteMundo = null;
export function createDevServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      res.setHeader('Cache-Control','no-store');
      res.setHeader('X-Content-Type-Options','nosniff');
      if (url.pathname.startsWith('/api/')) {
        const chunks=[]; let size=0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4 * 1024 * 1024) { res.writeHead(413).end('Corpo muito grande.'); return; }
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);
        if (!upstream) return demoApi(req, res, url, body);
        // Reutiliza a ponte da produção; a entrada apenas emite um crachá de sessão.
        if (req.method === 'GET' && url.pathname === '/api/painel'
            && url.searchParams.get('area') === 'vybes' && ['cerebro','agentes',...ETAPAS_LEITURA].includes(url.searchParams.get('etapa'))) {
          const entrada = await fetch(new URL('/api/painel?area=vybes', upstream), {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
            headers: { 'Content-Type': 'application/json', ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}) },
            body: JSON.stringify({ etapa: 'entrar' })
          });
          const d = await entrada.json().catch(() => ({}));
          if (!entrada.ok || !d.url) {
            res.writeHead(entrada.ok ? 502 : entrada.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: entrada.status === 401 ? 'Entre no painel para consultar o cérebro do VYBES.' : 'Não foi possível acessar a central com esta sessão. Verifique se o VYBES está online.' })); return;
          }
          try {
            const etapa = url.searchParams.get('etapa');
            const estudo = ETAPAS_LEITURA.includes(etapa) ? await lerEtapa(etapa, d.url, Object.fromEntries(url.searchParams)) : await (etapa === 'agentes' ? lerAgentesDaCentral : lerCerebroDaCentral)(d.url);
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(estudo));
          } catch (e) {
            res.writeHead(e.status || 502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }
        // Somente a sessão pode escrever no modo de inspeção. Dados exigem opção explícita.
        if (!['GET','HEAD','OPTIONS'].includes(req.method) && url.pathname !== '/api/sessao'
            && !ehLeituraPorPost(url) && !allowWrites) {
          res.writeHead(403,{'Content-Type':'application/json'}).end(JSON.stringify({ error:'Proxy local em modo somente leitura.' })); return;
        }
        const up = await fetch(new URL(url.pathname + url.search, upstream), {
          method:req.method, redirect:'manual', signal:AbortSignal.timeout(25000),
          headers:{ 'Content-Type':req.headers['content-type'] || 'application/json', ...(req.headers.cookie ? { Cookie:req.headers.cookie } : {}) },
          body:['GET','HEAD'].includes(req.method) ? undefined : body,
        });
        res.statusCode=up.status;
        res.setHeader('Content-Type',up.headers.get('content-type') || 'application/json');
        const cookies=up.headers.getSetCookie();
        if (cookies.length) res.setHeader('Set-Cookie',cookies.map((c) => c.replace(/;\s*Domain=[^;]+/ig,'').replace(/;\s*Secure/ig,'')));
        if(up.headers.get('location'))res.setHeader('Location',up.headers.get('location'));
        res.end(Buffer.from(await up.arrayBuffer())); return;
      }
      // /instalar é a página pública de instalar (no ar vem pelo rewrite do vercel.json); aqui ela também abre.
      const file = decodeURIComponent(['/', '/agenda'].includes(url.pathname) ? 'index.html' : url.pathname === '/instalar' ? 'instalar.html' : url.pathname.slice(1));
      const html = await readFile(resolve(ROOT,'index.html'),'utf8');
      const publicFiles = new Set(['index.html','cadastros_governed_v2.js','instalar.html',
        ...[...html.matchAll(/(?:src|href)="\/([^"?]+)"/g)].map((m)=>m[1])]);
      // As artes e os sons dos jogos (assets/jogos), o ser do VYBES e as falas dele (assets/vybes-fala) vêm pelo CSS e
      // pelo código, não pelo index.html.
      const daArte = /^assets\/jogos\/(sons\/)?[\w-]+\.(webp|ogg)$/.test(file) || file === 'assets/vybes-ser.webp' || /^assets\/vybes-fala\/[\w-]+\.(mp3|json)$/.test(file);
      // Mundo voxel: no build vai empacotado com hash; aqui é empacotado na hora, para editar e recarregar.
      // Três entradas (mundo-3d, mundo-leve, mundo-retratos) e os pedaços em comum (mundo-parte-*), como no build:
      // pedir uma entrada refaz o pacote; os pedaços saem do último pacote feito.
      const daEntrada = /^assets\/mundo\/(mundo-3d|mundo-leve|mundo-retratos)\.js$/.test(file), daParte = /^assets\/mundo\/mundo-parte-[A-Z0-9]+\.js$/.test(file);
      if ((daEntrada || daParte) && ['GET','HEAD'].includes(req.method) && ROOT === PROJECT) {
        if (daEntrada || !pacoteMundo) {
          const { build } = await import('esbuild');
          const r = await build({ entryPoints: Object.fromEntries(['mundo-3d', 'mundo-leve', 'mundo-retratos'].map((n) => [n, resolve(PROJECT, `mundo/${n}.mjs`)])), bundle: true, splitting: true, format: 'esm', write: false, target: 'es2022', sourcemap: 'inline', outdir: resolve(PROJECT, 'assets/mundo'), entryNames: '[name]', chunkNames: 'mundo-parte-[hash]' });
          pacoteMundo = new Map(r.outputFiles.map((f) => [f.path.split(/[\\/]/).pop(), f.text]));
        }
        const texto = pacoteMundo.get(file.split('/').pop());
        if (texto === undefined) { naoEncontrado(res); return; }
        res.writeHead(200, { 'Content-Type': TYPES['.js'] }); res.end(req.method === 'HEAD' ? undefined : texto); return;
      }
      // No --build o mundo vai com hash em dist/assets/mundo; o index.html não cita esses arquivos (antes dava 404).
      const doMundo = file === 'assets/mundo/irece.json' || file === 'assets/mundo/crm-irece.json'
        || (ROOT !== PROJECT && /^assets\/mundo\/mundo-(3d|leve|retratos|parte)-[A-Z0-9]{8}\.js$/.test(file));
      if ((!publicFiles.has(file) && !daArte && !doMundo) || !['GET','HEAD'].includes(req.method)) { naoEncontrado(res); return; }
      let data=await readFile(resolve(ROOT,file));
      // As folhas saem como no build: regras com :is() à direita ganham balde (scripts/css-baldes.mjs).
      if (ROOT === PROJECT && extname(file) === '.css') data = Buffer.from(baldearCss(data.toString()).css);
      if(file==='index.html') data=Buffer.from(data.toString().replace('</body>',
        '<div style="position:fixed;bottom:0;left:0;right:0;z-index:999999;background:#493700;color:white;text-align:center;font:12px sans-serif;padding:5px">AMBIENTE LOCAL · '+(upstream?'Proxy de inspeção':'Dados fictícios · senha: demo-local')+'</div></body>'));
      res.writeHead(200,{'Content-Type':TYPES[extname(file)] || 'application/octet-stream'});
      res.end(req.method==='HEAD' ? undefined : data);
    } catch (erro) {
      res.writeHead(502,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Falha no ambiente local: '+erro.message}));
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT || 4321);
  createDevServer().listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port} · ${upstream?'proxy explícito':'dados fictícios'}`));
}
