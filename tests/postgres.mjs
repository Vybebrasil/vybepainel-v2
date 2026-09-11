import { PGlite } from '@electric-sql/pglite';

// Um banco vazio com a mesma interface do @neondatabase/serverless: quem testa
// escreve o esquema de que precisa. Separado de database() para que um teste novo
// nao tenha que carregar as tabelas de outro — nem reescrever a etiqueta de SQL,
// que e onde duas versoes divergiriam.
export function conexao() {
  const db=new PGlite();
  const sql=(parts,...params)=>{
    const text=parts.reduce((s,p,i)=>s+(i?'$'+i:'')+p,'');
    return {text,params,then(resolve,reject){return db.query(text,params).then((r)=>r.rows).then(resolve,reject);}};
  };
  // O driver do Neon exige um template de verdade (ele confere strings.raw), e
  // DDL nao aceita parametro. sql.query e a porta que ele mesmo oferece para
  // isso — o dublê precisa ter a mesma porta, senao o teste passa por um caminho
  // que a producao nao usa.
  sql.query=(text,params=[])=>db.query(text,params).then((r)=>r.rows);
  sql.transaction=(queries)=>db.transaction(async(tx)=>{
    const out=[];for(const q of queries)out.push((await tx.query(q.text,q.params)).rows);return out;
  });
  return {db,sql};
}

export async function database() {
  const {db,sql}=conexao();
  await db.exec(`CREATE TABLE vybe_pessoas (id int primary key, monday_user_id text, nome text, ativo boolean);
    CREATE TABLE vybe_conteudos (id int primary key, monday_item_id text, board_id bigint, status_chave text, atualizado_em timestamptz);
    CREATE TABLE vybe_subitens (id int primary key, pai_id int, monday_item_id text, status_chave text, atualizado_em timestamptz);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, PRIMARY KEY(board_id,chave));
    CREATE TABLE vybe_conteudo_responsaveis (conteudo_id int, pessoa_id int, ordem int, PRIMARY KEY(conteudo_id,pessoa_id));
    CREATE TABLE vybe_conteudo_eventos (conteudo_id int, tipo text, de text, para text, autor_id int);
    INSERT INTO vybe_pessoas VALUES (1,'100','Antigo',true),(2,'200','Novo',true);
    INSERT INTO vybe_conteudos VALUES (1,'900',7829537690,'antigo',NOW());
    INSERT INTO vybe_subitens VALUES (42,1,'123456','antigo',NOW());
    INSERT INTO vybe_conteudo_responsaveis VALUES (1,1,0);`);
  return {db,sql};
}
