import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoApi } from './fixtures.mjs';

const PROJECT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ROOT = process.env.VYBE_DEV_BUILD === '1' || process.argv.includes('--build') ? resolve(PROJECT, 'dist') : PROJECT;
const upstream = process.env.VYBE_DEV_UPSTREAM;
const allowWrites = process.env.VYBE_DEV_ALLOW_WRITES === '1';
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png' };

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
        // Somente a sessão pode escrever no modo de inspeção. Dados exigem opção explícita.
        if (!['GET','HEAD','OPTIONS'].includes(req.method) && url.pathname !== '/api/sessao' && !allowWrites) {
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
      const file = decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
      const html = await readFile(resolve(ROOT,'index.html'),'utf8');
      const publicFiles = new Set(['index.html','cadastros_governed_v2.js',
        ...[...html.matchAll(/(?:src|href)="\/([^"?]+)"/g)].map((m)=>m[1])]);
      if (!publicFiles.has(file) || !['GET','HEAD'].includes(req.method)) { res.writeHead(404).end('Não encontrado.'); return; }
      let data=await readFile(resolve(ROOT,file));
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
