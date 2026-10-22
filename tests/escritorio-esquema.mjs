// Esquema mínimo do painel para os testes do Escritório (pontos, loja e marcos),
// com as migrações do Escritório aplicadas na ordem de produção.
import {readFileSync} from 'node:fs';
import {conexao} from './postgres.mjs';
export const MIGRACOES_ESCRITORIO=['2026-10-17-escritorio-vybecoins.sql','2026-10-17-escritorio-pontos.sql','2026-10-17-escritorio-loja.sql'];
// `historico` entra antes da loja (como em produção: marcado sem moedas);
// `semMarcas` apaga as marcas de instalação para fechar datas do passado no teste.
export async function bancoEscritorio(t,{historico=async()=>{},semMarcas=false}={}) {
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,monday_user_id text,ativo boolean DEFAULT true,pode_entrar boolean DEFAULT true);
 INSERT INTO vybe_pessoas(id,nome,monday_user_id) VALUES(1,'Paulo Martins','68035537'),(2,'Reriston Souza Silva','68036697'),(3,'Vinícius Damascena','68035653'),
  (4,'Deivid Oliveira Ribeiro','68997024'),(5,'Tainara Sodré','80146924'),(6,'Jady Amynne Oliveira Lima','100482777'),(7,'Beatriz Rocha Cardoso','71130408'),
  (24,'Ewerton Luis Souza da Silva','68036687'),(28,'Ademir Dourado Santana','78158742');
 CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true,responsavel text);
 INSERT INTO vybe_clientes VALUES(1,'Cliente laranja',true,'Vinícius'),(2,'Cliente azul',true,'Ewerton'),(3,'Sem carteira',true,NULL);
 CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,status_chave text,prazo date,veiculacao date,briefing text,removido_em timestamptz);
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean DEFAULT false,cor text);
 INSERT INTO vybe_status VALUES(8385559107,'feito','Feito',true),(8385559107,'pode_fazer','Pode Fazer',false),(8385559107,'alteracao','Alteração',false),
  (7829537690,'pode_fazer','Pode Fazer',false),(7829537690,'em_andamento','Em andamento',false),(7829537690,'para_aprovacao','Para aprovação',false),
  (7829537690,'alteracao','Alteração',false),(7829537690,'para_agendar','Para agendar',true),(7829537690,'agendado','Agendado',true),(7829537690,'finalizado','Finalizado',true),(7829537690,'segurar_post','Segurar Post',false);
 CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint,ordem int DEFAULT 0,PRIMARY KEY(conteudo_id,pessoa_id));
 CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint,PRIMARY KEY(conteudo_id,cliente_id));
 CREATE TABLE vybe_conteudo_eventos(id bigserial PRIMARY KEY,conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text,em timestamptz NOT NULL DEFAULT now());`);
 for(const f of ['2026-10-15-escritorio.sql','2026-10-16-escritorio-mapa.sql']) await db.exec(readFileSync('migrations/'+f,'utf8'));
 await historico(db,sql);
 for(const f of MIGRACOES_ESCRITORIO) await db.exec(readFileSync('migrations/'+f,'utf8'));
 if(semMarcas) await db.exec('DELETE FROM vybe_escritorio_fechamentos');
 return {db,sql};
}
