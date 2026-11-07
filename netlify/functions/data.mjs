// Netlify Function: datos en vivo para la página (solo lectura)
// Ruta pública: /api/data
// Seguridad: consultas fijas; NO devuelve datos personales (clientes, empleados, usuarios).
import mysql from "mysql2/promise";

export const config = { path: "/api/data" };

let pool = null;
const getPool = () =>
  (pool ??= mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 4000),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { minVersion: "TLSv1.2" },
    connectionLimit: 4,
    connectTimeout: 10000,
    decimalNumbers: true,
    dateStrings: true,
    enableKeepAlive: true,
  }));

const Q = {
  statsA: `SELECT (SELECT COUNT(*) FROM plantas) AS plants, (SELECT COUNT(*) FROM produccion_energia) AS production,
    (SELECT COUNT(*) FROM inventario) AS inventory, (SELECT COUNT(*) FROM biomasa) AS biomass,
    (SELECT COALESCE(SUM(cantidad),0) FROM produccion_energia) AS energy,
    (SELECT COALESCE(SUM(co2_evitado_ton),0) FROM control_ambiental) AS co2,
    (SELECT COALESCE(SUM(residuos_procesados_ton),0) FROM control_ambiental) AS waste`,
  // Solo conteos (requiere SELECT en estas tablas; ver grants_extra.sql)
  statsB: `SELECT (SELECT COUNT(*) FROM clientes) AS clients, (SELECT COUNT(*) FROM proveedores) AS providers, (SELECT COUNT(*) FROM facturas) AS invoices`,
  plants: `SELECT id_planta, nombre, ubicacion, capacidad, estado FROM plantas ORDER BY id_planta LIMIT 200`,
  productionRows: `SELECT id_produccion, id_planta, fecha, cantidad, unidad FROM produccion_energia ORDER BY fecha DESC, id_produccion DESC LIMIT 8`,
  biomass: `SELECT b.id_biomasa, b.nombre, b.id_tipo, t.nombre AS tipo, b.cantidad, b.unidad FROM biomasa b LEFT JOIN tipos_biomasa t ON t.id_tipo = b.id_tipo ORDER BY b.id_biomasa LIMIT 500`,
  inventory: `SELECT id_biomasa, id_almacen, stock FROM inventario ORDER BY id_biomasa LIMIT 1000`,
};
const ID = new Set(["id_planta", "id_produccion", "id_biomasa", "id_tipo", "id_almacen"]);
const strIds = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, ID.has(k) ? String(v) : v])));

let cache = { at: 0, body: null };

export default async (request) => {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60" };
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "Método no permitido." }), { status: 405, headers });
  if (cache.body && Date.now() - cache.at < 60000) return new Response(cache.body, { status: 200, headers });
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
    return new Response(JSON.stringify({ error: "Base de datos no configurada." }), { status: 503, headers: { ...headers, "Cache-Control": "no-store" } });
  }
  const keys = Object.keys(Q);
  const res = await Promise.allSettled(keys.map((k) => getPool().query({ sql: Q[k], timeout: 8000 })));
  const d = {};
  res.forEach((r, i) => {
    if (r.status === "fulfilled") d[keys[i]] = r.value[0];
    else console.error(`Consulta "${keys[i]}" falló:`, r.reason?.message || r.reason);
  });
  if (!d.statsA || !d.plants) {
    return new Response(JSON.stringify({ error: "No se pudo leer la base de datos." }), { status: 502, headers: { ...headers, "Cache-Control": "no-store" } });
  }
  const body = JSON.stringify({
    stats: { ...d.statsA[0], ...(d.statsB?.[0] || {}) },
    plants: strIds(d.plants),
    productionRows: strIds(d.productionRows || []),
    biomass: strIds(d.biomass || []),
    inventory: strIds(d.inventory || []),
  });
  cache = { at: Date.now(), body };
  return new Response(body, { status: 200, headers });
};
