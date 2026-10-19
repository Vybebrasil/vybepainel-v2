// E-mail do painel pelo Gmail da Vybe (decisão do Paulo, 19/10/2026). A conta
// e a senha de app ficam só nas variáveis da Vercel (GMAIL_USUARIO e
// GMAIL_SENHA_APP); nada disso passa pelo navegador nem pelo banco.
import nodemailer from 'nodemailer';

let transporte = null;
export function emailConfigurado() {
 return Boolean(process.env.GMAIL_USUARIO && process.env.GMAIL_SENHA_APP);
}
const enderecoValido = (v) => /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/.test(String(v || '').trim());
export async function enviarEmail({ para, assunto, html, texto }) {
 if (!emailConfigurado()) throw Object.assign(new Error('O e-mail do painel ainda não foi configurado.'), { status: 503 });
 const destinos = String(para || '').split(/[;,]/).map((e) => e.trim()).filter(enderecoValido);
 if (!destinos.length) throw Object.assign(new Error('O cliente não tem e-mail válido no cadastro.'), { status: 400 });
 transporte ||= nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 465, secure: true,
  auth: { user: process.env.GMAIL_USUARIO, pass: process.env.GMAIL_SENHA_APP },
 });
 const r = await transporte.sendMail({ from: `Vybe <${process.env.GMAIL_USUARIO}>`, to: destinos.join(', '), subject: assunto, html, text: texto });
 return { id: r.messageId, para: destinos };
}
