// Doble SQL para probar transacciones, claves únicas y contratos sin TiDB de producción.
// SQLite adapta funciones MySQL. No sustituye la validación final del dialecto en TiDB.
import { DatabaseSync } from 'node:sqlite';
export function fixture(){
  const db=new DatabaseSync(':memory:');
  const now=()=>new Date().toISOString().replace('T',' ').replace('Z','');
  db.function('NOW',{varargs:true},now);
  db.function('IF',(condition,a,b)=>condition?a:b);
  db.function('UNIX_TIMESTAMP',value=>value==null?null:Date.parse(String(value)+'Z')/1000);
  db.function('TIMESTAMPDIFF',(unit,a,b)=>a==null||b==null?null:Math.floor((Date.parse(b+'Z')-Date.parse(a+'Z'))/(unit==='HOUR'?3600000:60000)));
  db.function('FIELD',{varargs:true},(value,...values)=>values.indexOf(value)+1);
  db.exec(`CREATE TABLE solicitudes_ayuda(id INTEGER PRIMARY KEY AUTOINCREMENT,asunto TEXT,nombre TEXT,correo TEXT,categoria TEXT,prioridad TEXT,estado TEXT DEFAULT 'Abierto',descripcion TEXT,creado_en TEXT DEFAULT(strftime('%Y-%m-%d %H:%M:%f','now')),ia_respuesta TEXT,ia_herramientas TEXT,ia_escalar INTEGER DEFAULT 0,ia_motivo TEXT,ia_en TEXT);
  CREATE TABLE ayuda_control(id_solicitud INTEGER PRIMARY KEY,revision INTEGER DEFAULT 1,revision_ia INTEGER DEFAULT 0,estado_ia TEXT DEFAULT 'pendiente',intentos_ia INTEGER DEFAULT 0,lease_token TEXT,lease_hasta TEXT,reintentar_en TEXT,error_ia TEXT,responsable TEXT DEFAULT '',espera TEXT DEFAULT 'agente',confirmacion TEXT DEFAULT '',inconformidades INTEGER DEFAULT 0,ultima_actividad TEXT DEFAULT(strftime('%Y-%m-%d %H:%M:%f','now')),resuelto_en TEXT,creation_key TEXT UNIQUE,creation_fingerprint TEXT,creation_hasta TEXT,recovery_hash TEXT,recovery_hasta TEXT,recovery_intentos INTEGER DEFAULT 0,recovery_ultimo TEXT,recovery_ventana TEXT,recovery_envios INTEGER DEFAULT 0);
  CREATE TABLE ayuda_mensajes(id_mensaje INTEGER PRIMARY KEY AUTOINCREMENT,id_solicitud INTEGER,revision INTEGER,autor TEXT,nombre TEXT DEFAULT '',contenido TEXT,origen TEXT,herramientas TEXT,fuentes TEXT,client_key TEXT,registrado_en TEXT DEFAULT(strftime('%Y-%m-%d %H:%M:%f','now')),UNIQUE(id_solicitud,revision,autor),UNIQUE(id_solicitud,client_key));
  CREATE TABLE seguimiento_ayuda(id_seguimiento INTEGER PRIMARY KEY AUTOINCREMENT,id_solicitud INTEGER,responsable TEXT,nota TEXT,registrado_en TEXT DEFAULT(strftime('%Y-%m-%d %H:%M:%f','now')));
  CREATE TABLE plantas(id_planta INTEGER,nombre TEXT,ubicacion TEXT,capacidad NUMERIC,estado TEXT);
  INSERT INTO plantas VALUES(1,'Planta de prueba','Colombia',10,'Operativa');`);
  const sqlLog=[];
  function convert(sql){return sql.replace(/INSERT IGNORE/gi,'INSERT OR IGNORE').replace(/ FOR UPDATE/gi,'')
    .replace(/DATE_ADD\(NOW\(3\),INTERVAL (\d+) (MINUTE|SECOND)\)/gi,(_,n,unit)=>`strftime('%Y-%m-%d %H:%M:%f',NOW(3),'+${n} ${unit.toLowerCase()}s')`)
    .replace(/DATE_ADD\(NOW\(3\),INTERVAL \? MICROSECOND\)/gi,"strftime('%Y-%m-%d %H:%M:%f',NOW(3),'+' || (? / 1000000.0) || ' seconds')")
    .replace(/DATE_ADD\(\?,INTERVAL 1 DAY\)/gi,"datetime(?,'+1 day')")
    .replace(/TIMESTAMPDIFF\((HOUR|MINUTE),/gi,(_,unit)=>`TIMESTAMPDIFF('${unit}',`);}
  async function query({sql,values=[]}){
    sqlLog.push({sql,values});
    try{const statement=db.prepare(convert(sql));return /^\s*(SELECT|WITH)/i.test(sql)?[statement.all(...values),[]]:[{...statement.run(...values),insertId:Number(db.prepare('SELECT last_insert_rowid() AS id').get().id)},[]];}
    catch(error){if(/UNIQUE constraint/.test(error.message))error.code='ER_DUP_ENTRY';throw error;}
  }
  let tail=Promise.resolve();
  const pool={query,async getConnection(){let release;const wait=tail;tail=new Promise(r=>release=r);return {query,async beginTransaction(){await wait;db.exec('BEGIN');},async commit(){db.exec('COMMIT');},async rollback(){db.exec('ROLLBACK');},release(){release();}};}};
  return {db,pool,sqlLog,close(){db.close();}};
}
