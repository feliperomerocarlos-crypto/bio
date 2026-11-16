import nodemailer from 'nodemailer';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { canIssueToken, issueToken } from './access.mjs';
import { query, transaction, lockTicket, fail, clean } from './helpdesk-store.mjs';
export const recoveryEnabled=()=>canIssueToken()&&['SMTP_HOST','SMTP_USER','SMTP_PASSWORD','SUPPORT_FROM'].every(key=>!!process.env[key]);
const hash=(id,email,code)=>createHmac('sha256',process.env.TICKET_TOKEN_SECRET).update(`biovolt-recovery-v1:${id}:${email}:${code}`).digest('hex');
const generic={message:'Si la solicitud y el correo coinciden y el servicio de correo está disponible, recibirás un código de verificación. Revisa también spam.'};
export async function requestRecovery(id,emailValue,context){
  if(!recoveryEnabled())fail(503,'La recuperación por correo no está configurada. Contacta al equipo de soporte.');
  const email=clean(emailValue,120).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return generic;
  const ticket=(await query('SELECT id,correo FROM solicitudes_ayuda WHERE id=? AND LOWER(TRIM(correo))=? LIMIT 1',[id,email]))[0];
  if(!ticket)return generic;
  const code=String(randomInt(0,1000000)).padStart(6,'0'),hashed=hash(id,email,code);
  const allowed=await transaction(async q=>{
    const c=await lockTicket(id,q),now=Date.now();
    if(Number(c.recovery_last_ms)>now-60000)return false;
    const fresh=!(Number(c.recovery_window_ms)>now-3600000);
    if(!fresh&&Number(c.recovery_envios)>=5)return false;
    await q(`UPDATE ayuda_control SET recovery_hash=?,recovery_hasta=DATE_ADD(NOW(3),INTERVAL 10 MINUTE),recovery_intentos=0,
      recovery_ultimo=NOW(3),recovery_ventana=IF(?=1,NOW(3),recovery_ventana),recovery_envios=IF(?=1,1,recovery_envios+1) WHERE id_solicitud=?`,[hashed,fresh?1:0,fresh?1:0,id]);return true;
  });
  if(!allowed)return generic;
  const delivery=async()=>{ try{
    const port=Number(process.env.SMTP_PORT||465);
    const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,
      auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,tls:{minVersion:'TLSv1.2'}});
    try{await transport.sendMail({from:process.env.SUPPORT_FROM,to:ticket.correo,subject:'BioVolt · Verificación de acceso a tu solicitud',
      text:`Solicitaste recuperar el acceso a BV-${id}.\nTu código de verificación es: ${code}\nVence en 10 minutos y solo se puede usar una vez.\nSi no solicitaste este correo, ignóralo. No compartas el código.`});}
    finally{transport.close();}
  }catch{
    await query('UPDATE ayuda_control SET recovery_hash=NULL,recovery_hasta=NULL WHERE id_solicitud=? AND recovery_hash=?',[id,hashed]);
    // No registrar el correo ni el código; la respuesta pública no revela si el ticket existe.
    console.error('[mesa recuperación] envío no disponible');
  }};
  if(typeof context?.waitUntil==='function')context.waitUntil(delivery());else await delivery();
  return generic;
}
export async function verifyRecovery(id,emailValue,codeValue){
  if(!canIssueToken())fail(503,'La consulta privada no está configurada.');
  const email=clean(emailValue,120).toLowerCase(),code=clean(codeValue,12);
  if(!/^\d{6}$/.test(code))fail(400,'Código inválido o vencido.');
  const valid=await transaction(async q=>{
    const ticket=(await q('SELECT id FROM solicitudes_ayuda WHERE id=? AND LOWER(TRIM(correo))=? LIMIT 1',[id,email]))[0];
    if(!ticket)return false;
    const c=await lockTicket(id,q);
    if(!c.recovery_hash||Number(c.recovery_intentos)>=5||!Number.isFinite(Number(c.recovery_until_ms))||Number(c.recovery_until_ms)<=Date.now())return false;
    const actual=Buffer.from(hash(id,email,code)),expected=Buffer.from(c.recovery_hash);
    const matches=actual.length===expected.length&&timingSafeEqual(actual,expected);
    if(!matches){await q('UPDATE ayuda_control SET recovery_intentos=recovery_intentos+1 WHERE id_solicitud=?',[id]);return false;}
    await q('UPDATE ayuda_control SET recovery_hash=NULL,recovery_hasta=NULL,recovery_intentos=5 WHERE id_solicitud=?',[id]);return true;
  });
  if(!valid)fail(400,'Código inválido o vencido. Solicita otro si es necesario.');
  return {accessToken:issueToken(id)};
}
