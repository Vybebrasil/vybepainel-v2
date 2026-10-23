// Executar apenas com as variáveis de homologação fornecidas por canal seguro.
// Nunca recebe conexão/senha como argumento e não imprime valores sensíveis.
import {readFileSync} from 'node:fs';
import {randomBytes,scryptSync} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {verificarBancoHomologacao} from './assistente-homologacao.mjs';
verificarBancoHomologacao({habilitado:process.env.VYBE_HOMOLOGACAO,producao:process.env.VYBE_AI_PRODUCAO_DATABASE_URL,destino:process.env.VYBE_AI_HOMOLOG_DATABASE_URL});
const senha=process.env.VYBE_AI_HOMOLOG_SENHA;
if(!senha || senha.length<16)throw Error('Defina uma senha de teste forte por variável, nunca por argumento.');
const sql=neon(process.env.VYBE_AI_HOMOLOG_DATABASE_URL);
try {
 const [reais]=await sql`SELECT count(*)::int n FROM vybe_pessoas WHERE id NOT IN (900000001,900000002) OR email IS NULL OR email NOT IN ('ai-homologacao-a@vybe.invalid','ai-homologacao-b@vybe.invalid') OR admin`;
 if(reais.n!==0)throw Error('O banco contém pessoas fora das duas contas fictícias; preparação bloqueada.');
 const migracao=readFileSync(new URL('../migrations/2026-10-23-assistente-vinculos.sql',import.meta.url),'utf8');
 // Esta migração contém apenas DDL simples, sem funções ou strings com ";".
 const comandos=migracao.split(';').map(s=>s.trim()).filter(Boolean);
 await sql.transaction(comandos.map(s=>sql.query(s)));
 const pessoas=[[900000001,'Paulo Teste AI — fictício','ai-homologacao-a@vybe.invalid'],[900000002,'Jady Teste AI — fictício','ai-homologacao-b@vybe.invalid']];
 const queries=pessoas.map(([id,nome,email])=>{
  const sal=randomBytes(16).toString('hex'),hash=scryptSync(senha,Buffer.from(sal,'hex'),64).toString('hex');
  return sql`INSERT INTO vybe_pessoas(id,nome,email,ativo,pode_entrar,admin,senha_hash,senha_sal) VALUES(${id},${nome},${email},true,true,false,${hash},${sal})
   ON CONFLICT(id) DO UPDATE SET senha_hash=EXCLUDED.senha_hash,senha_sal=EXCLUDED.senha_sal WHERE vybe_pessoas.email=EXCLUDED.email AND NOT vybe_pessoas.admin`;
 });
 queries.push(sql`INSERT INTO vybe_clientes(id,nome) VALUES(900000201,'Cliente Fictício AI') ON CONFLICT DO NOTHING`);
 const [status]=await sql`SELECT chave FROM vybe_status WHERE board_id=8385559107 AND ativa AND NOT final ORDER BY ordem LIMIT 1`;
 if(!status)throw Error('Copie as configurações de status antes de preparar as demandas fictícias.');
 queries.push(sql`INSERT INTO vybe_conteudos(id,titulo,board_id,status_chave,prazo,veiculacao) VALUES
  (900000101,'AI teste: demanda da conta A',8385559107,${status.chave},CURRENT_DATE,CURRENT_DATE+1),
  (900000102,'AI teste: demanda da conta B',8385559107,${status.chave},CURRENT_DATE,CURRENT_DATE+1) ON CONFLICT DO NOTHING`);
 queries.push(sql`INSERT INTO vybe_conteudo_responsaveis(conteudo_id,pessoa_id) VALUES(900000101,900000001),(900000102,900000002) ON CONFLICT DO NOTHING`);
 queries.push(sql`INSERT INTO vybe_conteudo_clientes(conteudo_id,cliente_id) VALUES(900000101,900000201),(900000102,900000201) ON CONFLICT DO NOTHING`);
 queries.push(sql`INSERT INTO vybe_escritorio_funcoes(pessoa_id,funcao) VALUES(900000001,'gestao'),(900000002,'criacao') ON CONFLICT DO NOTHING`);
 await sql.transaction(queries);
 console.log('Migração aplicada no Neon isolado. Duas contas não administrativas e duas demandas fictícias preparadas.');
} catch(e) {
 // Não imprimir objetos do driver: podem carregar detalhes da conexão.
 console.error('Preparação interrompida.',/^[0-9A-Z]{5}$/.test(e.code||'')?'SQLSTATE '+e.code:e.message?.includes('bloqueada')?e.message:'Confira os pré-requisitos da homologação.');process.exitCode=1;
}
