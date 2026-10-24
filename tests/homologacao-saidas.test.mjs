import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { emailConfigurado, enviarEmail } from '../server/email.js';
import { tokenGoogle, enviarParteNoDrive } from '../vybe_drive.js';
import { eventoNaAgenda } from '../server/captacoes.js';
import { listarAgendaProducao } from '../server/agenda-producao.js';
import { prepararChamadaEscritorio } from '../server/escritorio-chamadas.js';

const keys=['VERCEL_ENV','VERCEL_GIT_COMMIT_REF','VYBE_HOMOLOGACAO','GMAIL_USUARIO','GMAIL_SENHA_APP','GOOGLE_SERVICE_ACCOUNT'];
function preservar(){const values=Object.fromEntries(keys.map(k=>[k,process.env[k]]));return ()=>{for(const k of keys){if(values[k]===undefined)delete process.env[k];else process.env[k]=values[k];}};}
function preview(){process.env.VERCEL_ENV='preview';process.env.VERCEL_GIT_COMMIT_REF='feature/vybe-ai-readonly-integration';delete process.env.VYBE_HOMOLOGACAO;}
const email={para:'cliente@example.invalid',assunto:'Teste ficticio',texto:'Fixture'};

test('SMTP bloqueia antes de criar transporte, mesmo sem flag e com credenciais herdadas',async()=>{
 const restore=preservar(),original=nodemailer.createTransport;let creates=0,sends=0;
 try{
  preview();process.env.GMAIL_USUARIO='ficticio@example.invalid';process.env.GMAIL_SENHA_APP='ficticio';
  nodemailer.createTransport=()=>{creates++;return {sendMail:async()=>{sends++;return {messageId:'mock'};}};};
  assert.equal(emailConfigurado(),false);
  await assert.rejects(enviarEmail(email),{status:503});
  assert.equal(creates,0);assert.equal(sends,0);
 }finally{restore();nodemailer.createTransport=original;}
});

test('Production e outra branch preservam SMTP simulado; Preview bloqueia transporte ja cacheado',async()=>{
 const restore=preservar(),original=nodemailer.createTransport;let sends=0;
 try{
  process.env.GMAIL_USUARIO='ficticio@example.invalid';process.env.GMAIL_SENHA_APP='ficticio';
  nodemailer.createTransport=()=>({sendMail:async()=>{sends++;return {messageId:'mock'};}});
  for(const [env,branch] of [['production','feature/vybe-ai-readonly-integration'],['preview','outra-branch']]){
   process.env.VERCEL_ENV=env;process.env.VERCEL_GIT_COMMIT_REF=branch;process.env.VYBE_HOMOLOGACAO='1';
   assert.equal(emailConfigurado(),true);assert.equal((await enviarEmail(email)).id,'mock');
  }
  assert.equal(sends,2);preview();await assert.rejects(enviarEmail(email),{status:503});assert.equal(sends,2);
 }finally{restore();nodemailer.createTransport=original;}
});

test('Google Drive, Calendar e RealtimeKit nao acessam rede na Preview isolada sem flag',async()=>{
 const restore=preservar(),original=globalThis.fetch;let network=0,db=0;
 try{
  preview();process.env.GOOGLE_SERVICE_ACCOUNT='{"client_email":"ficticio@example.invalid","private_key":"ficticio"}';
  globalThis.fetch=async()=>{network++;throw new Error('Rede proibida no teste');};
  const sql=Object.assign(async()=>{db++;return [];},{comTransacao:async()=>{db++;throw new Error('Banco proibido neste teste');}});
  for(const call of [()=>tokenGoogle(),()=>enviarParteNoDrive({}),
   ()=>eventoNaAgenda('criar',{}),()=>listarAgendaProducao('2026-10-24'),
   ()=>prepararChamadaEscritorio(sql,{id:1,nome:'Ficticio'},'escritorio',{})]){
   await assert.rejects(call,/desativadas neste ambiente de homologação/);
  }
  assert.equal(network,0);assert.equal(db,0);
 }finally{restore();globalThis.fetch=original;}
});
