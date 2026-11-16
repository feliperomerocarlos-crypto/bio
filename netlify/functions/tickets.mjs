// Netlify Function: solicitudes de la mesa de ayuda guardadas en la base de datos
// Ruta pública: /api/tickets
//   GET     -> lista las últimas solicitudes (el correo NUNCA se devuelve)
//   POST    -> crea una solicitud
//   PATCH   -> cambia el estado   (requiere la clave de docente: cabecera x-admin-pin)
//   DELETE  -> elimina            (requiere la clave de docente)
// Variable de entorno extra: AYUDA_PIN (clave de docente). Sin ella, PATCH y DELETE quedan desactivados.
import mysql from "mysql2/promise";

export const config = { path: "/api/tickets" };
const CATS = ["Sistemas", "Inventario", "Producción", "Logística", "Administración", "Otro"];
const PRIOS = ["Baja", "Media", "Alta", "Crítica"];
const ESTADOS = ["Abierto", "En proceso", "Resuelto"];

let pool = null;
const q = async (sql, values = []) =>
  (await (pool ??= mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 4000), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, ssl: { minVersion: "TLSv1.2" },
    connectionLimit: 4, connectTimeout: 10000, decimalNumbers: true, dateStrings: true, enableKeepAlive: true,
  })).query({ sql, values, timeout: 8000 }))[0];

const COLS = `id, asunto, nombre, categoria, prioridad, estado, descripcion, UNIX_TIMESTAMP(creado_en)*1000 AS ts,
  ia_respuesta, ia_herramientas, ia_escalar, ia_motivo, UNIX_TIMESTAMP(ia_en)*1000 AS ia_ts`;
const fmt = (r) => ({
  id: "BV-" + r.id, subject: r.asunto, name: r.nombre, email: "Oculto por privacidad", category: r.categoria,
  priority: r.prioridad, status: r.estado, description: r.descripcion, createdAt: Number(r.ts),
  ai: r.ia_respuesta ? { respuesta: r.ia_respuesta, herramientas: r.ia_herramientas ? r.ia_herramientas.split("|") : [],
    escalar: !!r.ia_escalar, motivo: r.ia_motivo || "", at: Number(r.ia_ts) || null } : null,
});

const hits = new Map();
const limited = (ip) => { const n = Date.now(); const r = (hits.get(ip) || []).filter((t) => n - t < 60000); r.push(n); hits.set(ip, r); if (hits.size > 5000) hits.clear(); return r.length > 6; };

export default async (request, context) => {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  const out = (status, data) => new Response(JSON.stringify(data), { status, headers });
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) return out(503, { error: "Base de datos no configurada." });
  const url = new URL(request.url);
  try {
    if (request.method === "GET") {
      const rows = await q(`SELECT ${COLS} FROM solicitudes_ayuda ORDER BY id DESC LIMIT 100`);
      return out(200, { tickets: rows.map(fmt) });
    }
    if (request.method === "POST") {
      if (limited(context?.ip || request.headers.get("x-nf-client-connection-ip") || "anon")) return out(429, { error: "Demasiadas solicitudes seguidas. Espera un minuto." });
      const b = await request.json().catch(() => ({}));
      const s = (v, n) => String(v ?? "").trim().slice(0, n);
      const t = { nombre: s(b.name, 80), correo: s(b.email, 120), asunto: s(b.subject, 90), descripcion: s(b.description, 500) };
      if (t.nombre.length < 3) return out(400, { error: "Escribe tu nombre." });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t.correo)) return out(400, { error: "Escribe un correo válido." });
      if (t.asunto.length < 5) return out(400, { error: "El asunto es muy corto." });
      if (t.descripcion.length < 15) return out(400, { error: "Describe el problema con más detalle." });
      if (!CATS.includes(b.category) || !PRIOS.includes(b.priority)) return out(400, { error: "Categoría o prioridad no válida." });
      const [{ n }] = await q("SELECT COUNT(*) AS n FROM solicitudes_ayuda");
      if (n >= 2000) return out(429, { error: "Se alcanzó el límite de solicitudes del proyecto." });
      const res = await q(`INSERT INTO solicitudes_ayuda (asunto, nombre, correo, categoria, prioridad, descripcion) VALUES (?,?,?,?,?,?)`,
        [t.asunto, t.nombre, t.correo, b.category, b.priority, t.descripcion]);
      const [row] = await q(`SELECT ${COLS} FROM solicitudes_ayuda WHERE id = ?`, [res.insertId]);
      return out(201, { ticket: fmt(row) });
    }
    if (request.method === "PATCH" || request.method === "DELETE") {
      const pin = process.env.AYUDA_PIN;
      if (!pin) return out(403, { error: "Esta acción está desactivada: falta configurar la clave de docente." });
      if (request.headers.get("x-admin-pin") !== pin) return out(403, { error: "Clave incorrecta." });
      const id = parseInt(String(url.searchParams.get("id") || "").replace(/\D/g, ""), 10);
      if (!id) return out(400, { error: "Falta la solicitud." });
      if (request.method === "DELETE") { await q("DELETE FROM solicitudes_ayuda WHERE id = ?", [id]); return out(200, { ok: true }); }
      const b = await request.json().catch(() => ({}));
      if (!ESTADOS.includes(b.estado)) return out(400, { error: "Estado no válido." });
      await q("UPDATE solicitudes_ayuda SET estado = ? WHERE id = ?", [b.estado, id]);
      const [row] = await q(`SELECT ${COLS} FROM solicitudes_ayuda WHERE id = ?`, [id]);
      return row ? out(200, { ticket: fmt(row) }) : out(404, { error: "La solicitud no existe." });
    }
    return out(405, { error: "Método no permitido." });
  } catch (e) {
    console.error("Error en solicitudes:", e?.message || e);
    return out(502, { error: "No se pudo acceder a las solicitudes." });
  }
};
