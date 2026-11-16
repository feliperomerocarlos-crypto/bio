// Comentarios internos y asignación de tickets; acceso exclusivo del docente.
import mysql from 'mysql2/promise';
import { RESPONSABLES } from '../../lib/helpdesk-store.mjs';
import { timingSafeEqual } from 'node:crypto';
export const config = { path: '/api/seguimiento' };
let pool;
const q = async (sql, params = []) => (await (pool ??= mysql.createPool({
  host:process.env.DB_HOST, port:Number(process.env.DB_PORT||4000), user:process.env.DB_USER,
  password:process.env.DB_PASSWORD, database:process.env.DB_NAME,
  ssl:{minVersion:'TLSv1.2'},connectionLimit:3,connectTimeout:8000
})).query({sql, values:params, timeout:8000}))[0];
const matches=(a,b)=>{
  if(typeof a!=='string'||typeof b!=='string')return false;
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length&&timingSafeEqual(x,y);
};
const counters=new Map();
const throttled=ip=>{
  const now=Date.now(), stamps=(counters.get(ip)||[]).filter(t=>now-t<60000);
  stamps.push(now);counters.set(ip,stamps);
  if(counters.size>1000)counters.clear();
  return stamps.length>20;
};
export default async (request,context)=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  const out=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  if(!['GET','POST'].includes(request.method))return out(405,{error:'Método no permitido.'});
  const ip=context?.ip || request.headers.get('x-nf-client-connection-ip') || 'anon';
  if(throttled(ip))return out(429,{error:'Demasiadas consultas seguidas.'});
  if(!process.env.AYUDA_PIN||!matches(request.headers.get('x-admin-pin'),process.env.AYUDA_PIN))return out(403,{error:'Acceso reservado al docente.'});
  const url=new URL(request.url);const id=Number(url.searchParams.get('id'));
  if(!Number.isSafeInteger(id)||id<1)return out(400,{error:'ID de solicitud inválido.'});
  try{
    if(request.method==='GET'){
      const rows=await q('SELECT id_seguimiento, responsable, nota, UNIX_TIMESTAMP(registrado_en)*1000 AS fecha FROM seguimiento_ayuda WHERE id_solicitud=? ORDER BY id_seguimiento DESC LIMIT 100',[id]);
      return out(200,{seguimiento:rows});
    }
    const body=await request.json().catch(()=>({}));
    const nota=String(body.nota??'').trim().slice(0,500);
    const responsable=String(body.responsable??'').trim().slice(0,80);
    if(!RESPONSABLES.includes(responsable))return out(400,{error:'Selecciona un responsable autorizado.'});
    if(nota.length<3)return out(400,{error:'Escribe una nota de al menos tres caracteres.'});
    const exists=await q('SELECT id FROM solicitudes_ayuda WHERE id=? LIMIT 1',[id]);
    if(!exists.length)return out(404,{error:'No existe la solicitud.'});
    await q('INSERT INTO seguimiento_ayuda(id_solicitud,responsable,nota) VALUES(?,?,?)',[id,responsable,nota]);
    await q('UPDATE ayuda_control SET ultima_actividad=NOW(3) WHERE id_solicitud=?',[id]);
    return out(201,{ok:true});
  }catch(e){console.error('Seguimiento:',e?.message||e);return out(502,{error:'No se pudo consultar el seguimiento. Comprueba que la tabla seguimiento_ayuda está creada.'});}
};
