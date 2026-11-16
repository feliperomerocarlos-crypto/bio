import mysql from 'mysql2/promise';
let pool;
export const getPool = () => (pool ??= mysql.createPool({
  host:process.env.DB_HOST, port:Number(process.env.DB_PORT || 4000), user:process.env.DB_USER,
  password:process.env.DB_PASSWORD, database:process.env.DB_NAME, ssl:{minVersion:'TLSv1.2'},
  connectionLimit:4, connectTimeout:10000, decimalNumbers:true, dateStrings:true, enableKeepAlive:true,
}));
export const query = async (sql, values=[], connection=getPool()) => (await connection.query({sql,values,timeout:8000}))[0];
export async function transaction(work) {
  const connection=await getPool().getConnection();
  try { await connection.beginTransaction();const result=await work((sql,values=[])=>query(sql,values,connection));await connection.commit();return result; }
  catch(error){await connection.rollback();throw error;}finally{connection.release();}
}
