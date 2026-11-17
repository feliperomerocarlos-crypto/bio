/* Utilidades compartidas: sin dependencias y sin credenciales de infraestructura. */
(function (root) {
  const kwh = row => {
    const n = Number(row.cantidad), unit = String(row.unidad || '').trim().toLowerCase();
    return Number.isFinite(n) && (unit === 'kwh' || unit === 'mwh') ? n * (unit === 'mwh' ? 1000 : 1) : null;
  };
  const csv = rows => '\uFEFF' + rows.map(row => row.map(value => {
    let s = String(value ?? '');
    // Evita fórmulas al abrir texto no confiable en Excel.
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }).join(';')).join('\r\n');
  function simulate({ mass, yieldKwh, efficiency, price }) {
    const values = [mass, yieldKwh, efficiency, price].map(Number);
    if (values.some(v => !Number.isFinite(v) || v < 0) || values[2] > 100) throw new Error('Revisa los valores: cantidades positivas y eficiencia entre 0 y 100.');
    const energy = values[0] * values[1] * values[2] / 100, revenue = energy * values[3];
    if (!Number.isFinite(energy) || !Number.isFinite(revenue)) throw new Error('Los valores exceden el rango de cálculo.');
    return { kwh: energy, revenue };
  }
  const fetchJSON = async (url, options = {}) => {
    const response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(25000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || 'No se pudo completar la consulta.'); error.status = response.status; throw error; }
    return data;
  };
  root.BioVolt = { kwh, csv, simulate, fetchJSON };
})(globalThis);
