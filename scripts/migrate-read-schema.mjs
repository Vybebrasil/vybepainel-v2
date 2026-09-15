import { neon } from '@neondatabase/serverless';
import { migrarEsquemaDeLeitura } from '../vybe_dominio_store.js';

if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL para o banco que receberá a migração.');
await migrarEsquemaDeLeitura(neon(process.env.DATABASE_URL));
console.log('Esquema de leitura migrado e verificado.');
