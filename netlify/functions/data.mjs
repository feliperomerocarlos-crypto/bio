// Netlify Function: datos en vivo para la página (solo lectura)
// Ruta pública: /api/data
// Seguridad: consultas fijas; NO devuelve datos personales (clientes, empleados, usuarios).
import mysql from "mysql2/promise";
import { throttled } from '../../lib/access.mjs';
import { energySQL, period } from "../../lib/analytics.mjs";

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
    (SELECT COALESCE(SUM(${energySQL('e')}),0) FROM produccion_energia e) AS energy,
    (SELECT COUNT(*) FROM produccion_energia WHERE LOWER(TRIM(unidad)) NOT IN ('kwh','mwh') OR unidad IS NULL) AS energyUnknown,
    (SELECT COALESCE(SUM(co2_evitado_ton),0) FROM control_ambiental) AS co2,
    (SELECT COALESCE(SUM(residuos_procesados_ton),0) FROM control_ambiental) AS waste`,
  // Solo conteos (requiere SELECT en estas tablas; ver grants_extra.sql)
  statsB: `SELECT (SELECT COUNT(*) FROM clientes) AS clients, (SELECT COUNT(*) FROM proveedores) AS providers, (SELECT COUNT(*) FROM facturas) AS invoices`,
  plants: `SELECT id_planta, nombre, ubicacion, capacidad, estado FROM plantas ORDER BY id_planta LIMIT 200`,
  productionRows: `SELECT id_produccion, id_planta, fecha, cantidad, unidad FROM produccion_energia ORDER BY fecha DESC, id_produccion DESC LIMIT 8`,
  biomass: `SELECT b.id_biomasa, b.nombre, b.id_tipo, t.nombre AS tipo, b.cantidad, b.unidad FROM biomasa b LEFT JOIN tipos_biomasa t ON t.id_tipo = b.id_tipo ORDER BY b.id_biomasa LIMIT 500`,
  maintenance: `SELECT p.nombre AS planta, COUNT(*) AS registros, ROUND(SUM(m.costo),2) AS costo FROM mantenimiento m JOIN equipos e ON e.id_equipo=m.id_equipo JOIN plantas p ON p.id_planta=e.id_planta GROUP BY p.nombre ORDER BY p.nombre LIMIT 200`,
  efficiency: `SELECT t.nombre AS tipo, COUNT(*) AS pruebas, ROUND(AVG(p.eficiencia_energetica_porcentaje),2) AS eficiencia FROM pruebas_eficiencia p JOIN biomasa b ON b.id_biomasa=p.id_biomasa JOIN tipos_biomasa t ON t.id_tipo=b.id_tipo GROUP BY t.nombre ORDER BY t.nombre LIMIT 100`,
  inventory: `SELECT id_biomasa, id_almacen, stock FROM inventario ORDER BY id_biomasa LIMIT 1000`,
};
const ID = new Set(["id_planta", "id_produccion", "id_biomasa", "id_tipo", "id_almacen"]);
const strIds = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, ID.has(k) ? String(v) : v])));

let cache = { at: 0, body: null };

export default async (request, context) => {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60" };
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "Método no permitido." }), { status: 405, headers });
  if (throttled(request, context, "data", 30)) return new Response(JSON.stringify({ error: "Demasiadas consultas. Espera un minuto." }), { status: 429, headers: { ...headers, "Cache-Control":"no-store" } });
  const url = new URL(request.url);
  if (url.searchParams.get("view") === "analytics") {
    let range;
    try { range = period(url); } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...headers, "Cache-Control": "no-store" } }); }
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) return new Response(JSON.stringify({ error: "Base de datos no configurada." }), { status: 503, headers });
    const plant = url.searchParams.get('plant') || '';
    if (plant && !/^[1-9]\d{0,14}$/.test(plant)) return new Response(JSON.stringify({ error: "Planta inválida." }), { status: 400, headers });
    const read = async (sql, values) => (await getPool().query({ sql, values, timeout: 8000 }))[0];
    const filter = "fecha >= ? AND fecha < DATE_ADD(?, INTERVAL 1 DAY) AND (? = '' OR id_planta = ?)";
    try {
      const summary = (a, b) => read(`SELECT COUNT(*) AS records, COALESCE(SUM(${energySQL('e')}),0) AS kwh,
        SUM(CASE WHEN LOWER(TRIM(unidad)) IN ('kwh','mwh') THEN 0 ELSE 1 END) AS unknown FROM produccion_energia e WHERE ${filter}`, [a,b,plant,plant]);
      const [current, previous, daily, plants] = await Promise.all([
        summary(range.from, range.to), summary(range.previousFrom, range.previousTo),
        read(`SELECT DATE(fecha) AS date, COALESCE(SUM(${energySQL('e')}),0) AS kwh FROM produccion_energia e WHERE ${filter} GROUP BY DATE(fecha) ORDER BY DATE(fecha) LIMIT 366`, [range.from,range.to,plant,plant]),
        read(`SELECT e.id_planta, p.nombre, COUNT(*) AS records, COALESCE(SUM(${energySQL('e')}),0) AS kwh FROM produccion_energia e LEFT JOIN plantas p ON p.id_planta=e.id_planta WHERE ${filter.replaceAll('id_planta', 'e.id_planta').replaceAll('fecha','e.fecha')} GROUP BY e.id_planta,p.nombre ORDER BY kwh DESC LIMIT 200`, [range.from,range.to,plant,plant])
      ]);
      return new Response(JSON.stringify({ source: 'tidb', unit: 'kWh', range, current: current[0], previous: previous[0], daily, plants }), { status: 200, headers: { ...headers, "Cache-Control": "no-store" } });
    } catch (e) { console.error('Analytics:', e?.message); return new Response(JSON.stringify({ error: "No se pudo consultar el periodo." }), { status: 502, headers: { ...headers, "Cache-Control": "no-store" } }); }
  }
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
    source: "tidb", generatedAt: new Date().toISOString(),
    stats: { ...d.statsA[0], ...(d.statsB?.[0] || { clients: null, providers: null, invoices: null }) },
    availability: { productionRows: !!d.productionRows, biomass: !!d.biomass, inventory: !!d.inventory },
    operations: { maintenance: d.maintenance ?? null, efficiency: d.efficiency ?? null },
    plants: strIds(d.plants),
    productionRows: d.productionRows ? strIds(d.productionRows) : null,
    biomass: d.biomass ? strIds(d.biomass) : null,
    inventory: d.inventory ? strIds(d.inventory) : null,
  });
  cache = { at: Date.now(), body };
  return new Response(body, { status: 200, headers });
};
