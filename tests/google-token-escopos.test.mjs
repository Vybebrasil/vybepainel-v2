import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { tokenGoogle } from '../vybe_drive.js';

test('autenticação Google mantém caches separados para Drive e leitura da agenda',async()=>{
  const credencial=process.env.GOOGLE_SERVICE_ACCOUNT;
  const homologacao=process.env.VYBE_HOMOLOGACAO;
  const original=global.fetch;
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
  const scopes=[];
  try {
    delete process.env.VYBE_HOMOLOGACAO;
    process.env.GOOGLE_SERVICE_ACCOUNT=JSON.stringify({client_email:'teste@example.invalid',private_key:privateKey});
    global.fetch=async(_url,op)=>{
      const jwt=op.body.get('assertion');
      const payload=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString());
      scopes.push(payload.scope);
      return {ok:true,json:async()=>({access_token:`ficticio-${scopes.length}`,expires_in:3600})};
    };
    assert.equal(await tokenGoogle(),'ficticio-1');
    const agenda='https://www.googleapis.com/auth/calendar.events.readonly';
    assert.equal(await tokenGoogle(agenda),'ficticio-2');
    assert.equal(await tokenGoogle(),'ficticio-1');
    assert.equal(await tokenGoogle(agenda),'ficticio-2');
    assert.deepEqual(scopes,['https://www.googleapis.com/auth/drive',agenda]);
  } finally {
    global.fetch=original;
    if(credencial===undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT; else process.env.GOOGLE_SERVICE_ACCOUNT=credencial;
    if(homologacao===undefined) delete process.env.VYBE_HOMOLOGACAO; else process.env.VYBE_HOMOLOGACAO=homologacao;
  }
});
