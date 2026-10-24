// Guardas da homologação da Vybe AI: nenhuma conexão de escrita é criada
// antes de validar flag, endpoint de origem e endpoint de destino.
export function verificarBancoHomologacao({habilitado,producao,destino}) {
  if(habilitado!=='1')throw Error('Defina VYBE_HOMOLOGACAO=1 para operar o banco de teste.');
  let a,b;try{a=new URL(producao);b=new URL(destino);}catch{throw Error('Informe as duas conexões de banco sem colocá-las na linha de comando.');}
  const postgres=u=>['postgres:','postgresql:'].includes(u.protocol)&&u.hostname.endsWith('.neon.tech');
  if(!postgres(a)||!postgres(b))throw Error('São necessárias duas conexões Neon válidas.');
  const endpoint=u=>u.hostname.replace(/-pooler(?=\.)/,'');
  if(endpoint(a)===endpoint(b))throw Error('Migração bloqueada: homologação coincide com produção.');
  return true;
}
export function verificarUrlPreview(valor) {
  let u;try{u=new URL(valor);}catch{throw Error('Informe o URL de Preview.');}
  if(u.protocol!=='https:' || !/^vybepainel-v2-[a-z0-9-]+-vybe-hub\.vercel\.app$/.test(u.hostname) || u.hostname.includes('-git-main-') || u.pathname!=='/' || u.search || u.hash)
    throw Error('Os testes HTTP exigem um deployment Preview, nunca o domínio de produção.');
  return u.origin;
}
